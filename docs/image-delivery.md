# Static image delivery

Public images are served from the existing `https://cdn.bugoostudio.com` R2 custom domain. No Cloudflare Images subscription, image transformation Worker, or second website is required.

## Upload and display

- Cover and screenshot uploads retain their original bytes and create WebP widths 320, 640, 1280 and 1920 once, using Sharp. Sources are never enlarged. EXIF orientation is applied to display files.
- Original URLs contain `covers/v1/<random>/original-w<intrinsic-width>.<ext>` (or `screenshots/...`). Fixed sibling files are `w-640.webp`, etc. The URL is returned only after all writes succeed. Failed uploads clean up their partial files.
- `SiteImage` preserves Next Image layout/lazy loading with a custom static-file loader. Local images, old unmigrated images, external avatars, and animated formats load directly. Native image paths use `CdnImage` and responsive `srcSet`.
- GIF and animated WebP files are served unchanged. Lightboxes continue loading the original. Download URLs and database records are unchanged.
- Image objects have `Cache-Control: public, max-age=31536000, immutable`. Uploads have random keys, so replacements get new URLs.

## Existing images

`npx tsx scripts/backfill-image-variants.ts` lists the pending legacy objects without writing.

`npx tsx scripts/backfill-image-variants.ts --apply --limit=200` creates fixed display files next to original random-named images. It never overwrites originals or modifies database records. Only fully completed images are added to `src/lib/images/legacy-variants.json`, which must ship with the application. Rerunning resumes from that manifest and reuses completed files.

The manifest includes actual source widths so native `srcSet` descriptors remain correct for small images. Files not in the manifest load their original URL, avoiding broken variants during rollout. The orphan-file admin tool protects derived files while their original exists, and permits cleanup if their original is gone. It collects course/agenda/settings references and rechecks use before deletion. Deleting a source also deletes its four display files.

## Verification and rollback

Verify CDN requests return image content and `cf-cache-status: HIT` on repeat fetches. Page image requests must not contain `/_next/image` or `/cdn-cgi/image`.

Code changes require normal website deployment before production uses these files. Backfilled files alone do not alter the production page. Roll back the application changes if necessary; original objects and database URLs still work. Extra display files can remain safely until deliberate cleanup.

R2 storage and operation usage still apply. Static delivery does not consume either Vercel Image Optimization or Cloudflare Images transformation quota.
