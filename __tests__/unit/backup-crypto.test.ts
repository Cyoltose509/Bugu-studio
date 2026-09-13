/**
 * @vitest-environment node
 *
 * 备份加解密与 Comment 拓扑排序的纯函数测试（不连库、不碰 R2）。
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  encryptBackupPayload,
  decryptBackupPayload,
  isEncryptedBackupBlob,
} from "@/lib/backup/crypto";
import { sortSelfReferentialRecords } from "@/lib/backup/restore";

describe("backup crypto", () => {
  const prevAuth = process.env.AUTH_SECRET;
  const prevBackupKey = process.env.BACKUP_ENCRYPTION_KEY;

  beforeEach(() => {
    process.env.AUTH_SECRET = "test-auth-secret-for-backup-unit";
    delete process.env.BACKUP_ENCRYPTION_KEY;
  });

  afterEach(() => {
    if (prevAuth === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = prevAuth;
    if (prevBackupKey === undefined) delete process.env.BACKUP_ENCRYPTION_KEY;
    else process.env.BACKUP_ENCRYPTION_KEY = prevBackupKey;
  });

  it("加密后不是明文，且能还原", () => {
    const payload = {
      version: 3,
      tables: { user: [{ id: "u1", passwordHash: "hash-should-not-appear-in-cipher-as-plain" }] },
    };
    const enc = encryptBackupPayload(payload);
    expect(isEncryptedBackupBlob(enc)).toBe(true);
    expect(JSON.stringify(enc)).not.toContain("hash-should-not-appear-in-cipher-as-plain");
    expect(decryptBackupPayload(enc)).toEqual(payload);
  });

  it("拒绝未加密的旧明文备份", () => {
    expect(() =>
      decryptBackupPayload({ version: 1, tables: { user: [] } })
    ).toThrow(/不是加密格式/);
  });

  it("密钥错误时解密失败", () => {
    const enc = encryptBackupPayload({ version: 1, tables: {} });
    process.env.AUTH_SECRET = "another-secret";
    expect(() => decryptBackupPayload(enc)).toThrow();
  });
});

describe("sortSelfReferentialRecords", () => {
  it("多层回复：祖先在前", () => {
    const rows = [
      { id: "c3", parentId: "c2", content: "孙" },
      { id: "c1", parentId: null, content: "根" },
      { id: "c2", parentId: "c1", content: "子" },
    ];
    const sorted = sortSelfReferentialRecords(rows);
    expect(sorted.map((r) => r.id)).toEqual(["c1", "c2", "c3"]);
  });
});
