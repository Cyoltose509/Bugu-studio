import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ send: vi.fn(), prepare: vi.fn() }));
vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: class { send = mocks.send; },
  PutObjectCommand: class { constructor(public input: any) {} },
  DeleteObjectCommand: class { constructor(public input: any) {} },
  DeleteObjectsCommand: class { constructor(public input: any) {} },
}));
vi.mock("@/lib/images/prepare", () => ({ prepareImageVariants: mocks.prepare }));
import { uploadToR2, deleteFromR2 } from "@/lib/utils/upload";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("R2_ACCOUNT_ID", "test"); vi.stubEnv("R2_BUCKET_NAME", "test");
  vi.stubEnv("R2_ACCESS_KEY_ID", "test"); vi.stubEnv("R2_SECRET_ACCESS_KEY", "test");
  vi.stubEnv("R2_PUBLIC_URL", "https://cdn.bugoostudio.com/");
  mocks.send.mockResolvedValue({});
  mocks.prepare.mockResolvedValue([320,640,1280,1920].map(width=>({width,sourceWidth:1000,buffer:Buffer.from("webp")})));
});
describe("R2 image lifecycle", () => {
  it("publishes variants before the unchanged original and gives all objects immutable caching", async () => {
    const original=Buffer.from("original");
    const result=await uploadToR2(original,"photo.png","image/png","cover");
    const writes=mocks.send.mock.calls.map(([command])=>command.input);
    expect(writes).toHaveLength(5);
    expect(result.key).toMatch(/^covers\/v1\/[a-f0-9]{32}\/original-w1000\.png$/);
    expect(writes.slice(0,4).every(write=>write.ContentType==="image/webp")).toBe(true);
    expect(writes[4].Body).toBe(original);
    expect(writes.every(write=>write.CacheControl.includes("immutable"))).toBe(true);
    expect(result.url).toBe(`https://cdn.bugoostudio.com/${result.key}`);
  });
  it("cleans up incomplete uploads without publishing an original", async () => {
    mocks.send.mockRejectedValueOnce(new Error("storage failed"));
    await expect(uploadToR2(Buffer.from("original"),"photo.png","image/png","cover")).rejects.toThrow("storage failed");
    const commands=mocks.send.mock.calls.map(([command])=>command.input);
    expect(commands.filter(command=>command.ContentType==="image/png")).toHaveLength(0);
    expect(commands.at(-1).Delete.Objects).toHaveLength(5);
  });
  it("removes all derived files together with their original", async () => {
    expect(await deleteFromR2("https://cdn.bugoostudio.com/screenshots/v1/0123456789abcdef0123456789abcdef/original-w1000.png")).toBe(true);
    expect(mocks.send.mock.calls[0][0].input.Delete.Objects).toHaveLength(5);
  });
});

describe("original write failure",()=>{it("cleans completed variants if the original write fails",async()=>{mocks.send.mockImplementation(async(command)=>{if(command.input.ContentType==="image/png")throw Error("original failed");return {};});await expect(uploadToR2(Buffer.from("original"),"photo.png","image/png","cover")).rejects.toThrow("original failed");const commands=mocks.send.mock.calls.map(([command])=>command.input);expect(commands.at(-1).Delete.Objects).toHaveLength(5);});});
