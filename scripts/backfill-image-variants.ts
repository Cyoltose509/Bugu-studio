/** Usage: npx tsx scripts/backfill-image-variants.ts [--apply] [--limit=200] */
import { loadEnvConfig } from "@next/env";
import { S3Client, ListObjectsV2Command, GetObjectCommand, HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { readFile, writeFile, rename } from "node:fs/promises";
import path from "node:path";
import { prepareImageVariants } from "../src/lib/images/prepare";
import { IMAGE_WIDTHS } from "../src/lib/images/delivery";

loadEnvConfig(process.cwd());
const apply = process.argv.includes("--apply");
const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
const limit = limitArg ? Number(limitArg.split("=")[1]) : 200;
if (!Number.isInteger(limit) || limit < 1) throw new Error("--limit must be a positive integer");
for (const key of ["R2_ACCOUNT_ID", "R2_BUCKET_NAME", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_PUBLIC_URL"]) {
  if (!process.env[key]) throw new Error(`Missing configuration: ${key}`);
}
if (new URL(process.env.R2_PUBLIC_URL!).origin !== "https://cdn.bugoostudio.com") {
  throw new Error("Verify the delivery hostname before generating the legacy manifest");
}
const client = new S3Client({ region: "auto", endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID!, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY! }, forcePathStyle: true });
const Bucket = process.env.R2_BUCKET_NAME!;
const manifestPath = path.resolve("src/lib/images/legacy-variants.json");

async function main() {
  const known: Record<string, number> = JSON.parse(await readFile(manifestPath, "utf8"));
  const candidates: Array<{ key: string; bytes: number }> = [];
  for (const Prefix of ["covers/", "screenshots/"]) {
    let ContinuationToken: string | undefined;
    do {
      const page = await client.send(new ListObjectsV2Command({ Bucket, Prefix, ContinuationToken }));
      for (const item of page.Contents || []) {
        if (item.Key && /^(covers|screenshots)\/[a-f0-9]{32}\.(jpe?g|png|webp)$/i.test(item.Key) && !Object.hasOwn(known, item.Key)) {
          candidates.push({ key: item.Key, bytes: item.Size || 0 });
        }
      }
      ContinuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (ContinuationToken);
  }
  console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", known: Object.keys(known).length, pending: candidates.length,
    selected: Math.min(candidates.length, limit), originalBytes: candidates.reduce((sum, item) => sum + item.bytes, 0) }));
  if (!apply) return;
  let completed = 0, skipped = 0, failed = 0, outputBytes = 0;
  let manifestWrite = Promise.resolve();
  async function processItem({ key, bytes }: { key: string; bytes: number }) {
    if (bytes > 20 * 1024 * 1024) { skipped++; return; }
    try {
      const keys = IMAGE_WIDTHS.map((width) => `${key}.w-${width}.webp`);
      let sourceWidth = 0;
      const exists = await Promise.all(keys.map(async (Key) => {
        try {
          const head = await client.send(new HeadObjectCommand({ Bucket, Key }));
          sourceWidth = Math.max(sourceWidth, Number(head.Metadata?.["source-width"]) || 0);
          return head.ContentType === "image/webp" && (head.ContentLength || 0) > 0;
        } catch (error: any) {
          if (error.$metadata?.httpStatusCode === 404 || error.name === "NotFound") return false;
          throw error;
        }
      }));
      if (!exists.every(Boolean) || !sourceWidth) {
        const original = await client.send(new GetObjectCommand({ Bucket, Key: key }));
        if (!original.Body) throw new Error("Missing body");
        const mime = /\.png$/i.test(key) ? "image/png" : /\.webp$/i.test(key) ? "image/webp" : "image/jpeg";
        const variants = await prepareImageVariants(Buffer.from(await original.Body.transformToByteArray()), mime);
        if (!variants.length) { skipped++; return; }
        sourceWidth = variants[0].sourceWidth;
        for (const [index, variant] of variants.entries()) {
          if (!exists[index]) {
            await client.send(new PutObjectCommand({ Bucket, Key: keys[index], Body: variant.buffer,
              ContentType: "image/webp", CacheControl: "public, max-age=31536000, immutable",
              Metadata: { "image-variant": String(variant.width), "source-width": String(sourceWidth) } }));
            outputBytes += variant.buffer.length;
          }
        }
      }
      // Publish only after all four files exist. Original objects and DB URLs are untouched.
      known[key] = sourceWidth;
      manifestWrite = manifestWrite.then(async () => {
        const temp = `${manifestPath}.tmp`;
        await writeFile(temp, `${JSON.stringify(Object.fromEntries(Object.entries(known).sort()), null, 2)}\n`);
        await rename(temp, manifestPath);
      });
      await manifestWrite;
      completed++;
      if (completed % 10 === 0) console.log(JSON.stringify({ completed, skipped, failed }));
    } catch (error: any) {
      // Avoid printing SDK request objects/credentials. A failed item never enters the manifest.
      console.error(JSON.stringify({ failedKey: key, code: error.name || "Error", status: error.$metadata?.httpStatusCode }));
      failed++;
    }
  }
  const selected = candidates.slice(0, limit);
  for (let index = 0; index < selected.length; index += 4) {
    await Promise.all(selected.slice(index, index + 4).map(processItem));
  }
  console.log(JSON.stringify({ completed, skipped, failed, outputBytes, remaining: Math.max(0, candidates.length - limit) }));
  if (failed) process.exitCode = 1;
}
main().catch((error) => { console.error(error.name || "Backfill failed"); process.exitCode = 1; });
