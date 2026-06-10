/**
 * Cloudflare R2 对象存储监控页面
 * 通过 AWS SDK S3 ListObjectsV2 获取存储桶使用情况
 */

import { prisma } from "@/lib/db/prisma";
import Link from "next/link";
import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";

export const dynamic = "force-dynamic";

interface BucketStats {
  totalObjects: number;
  totalSize: number;
  totalSizeFormatted: string;
  byFolder: { folder: string; count: number; size: number; sizeFormatted: string }[];
  byType: { type: string; count: number; size: number; sizeFormatted: string }[];
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export default async function R2MonitorPage() {
  let stats: BucketStats | null = null;
  let error: string | null = null;
  let configured = false;

  const accountId = process.env.R2_ACCOUNT_ID;
  const bucketName = process.env.R2_BUCKET_NAME;
  const publicUrl = process.env.R2_PUBLIC_URL;
  const accessKey = process.env.R2_ACCESS_KEY_ID;
  const secretKey = process.env.R2_SECRET_ACCESS_KEY;

  // 用户头像计数（来自数据库）
  let userAvatarCount = 0;
  try {
    userAvatarCount = await prisma.user.count({ where: { image: { not: null, startsWith: publicUrl || "https://" } } });
  } catch {}

  configured = !!(accountId && bucketName && accessKey && secretKey);

  if (configured) {
    try {
      const client = new S3Client({
        region: "auto",
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId: accessKey!, secretAccessKey: secretKey! },
      });

      let continuationToken: string | undefined;
      let totalObjects = 0;
      let totalSize = 0;
      const folderStats: Record<string, { count: number; size: number }> = {};
      const typeStats: Record<string, { count: number; size: number }> = {};

      do {
        const cmd = new ListObjectsV2Command({
          Bucket: bucketName,
          ContinuationToken: continuationToken,
          MaxKeys: 1000,
        });
        const res = await client.send(cmd);

        for (const obj of res.Contents || []) {
          if (!obj.Key || !obj.Size) continue;

          totalObjects++;
          totalSize += obj.Size;

          // 按文件夹统计
          const folder = obj.Key.split("/")[0] || "root";
          if (!folderStats[folder]) folderStats[folder] = { count: 0, size: 0 };
          folderStats[folder].count++;
          folderStats[folder].size += obj.Size;

          // 按文件类型统计
          const ext = obj.Key.split(".").pop()?.toLowerCase() || "other";
          if (!typeStats[ext]) typeStats[ext] = { count: 0, size: 0 };
          typeStats[ext].count++;
          typeStats[ext].size += obj.Size;
        }

        continuationToken = res.NextContinuationToken;
      } while (continuationToken);

      stats = {
        totalObjects,
        totalSize,
        totalSizeFormatted: formatBytes(totalSize),
        byFolder: Object.entries(folderStats)
          .map(([folder, s]) => ({ folder, ...s, sizeFormatted: formatBytes(s.size) }))
          .sort((a, b) => b.size - a.size),
        byType: Object.entries(typeStats)
          .map(([type, s]) => ({ type, ...s, sizeFormatted: formatBytes(s.size) }))
          .sort((a, b) => b.size - a.size),
      };
    } catch (e: any) {
      error = e.message || "R2 连接失败";
      console.error("[monitor/r2]", e);
    }
  } else {
    error = "R2 未配置（缺少环境变量）";
  }

  return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/monitoring" className="text-sm hover:underline" style={{ color: "#3388BB" }}>
          ← 监控总览
        </Link>
        <h1 className="text-2xl font-bold" style={{ color: "#25547A" }}>☁️ R2 对象存储</h1>
      </div>

      {error && !stats ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm" style={{ color: "#C62828" }}>
          {error}
        </div>
      ) : stats ? (
        <>
          {/* 概览卡片 */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <StatCard label="总文件数" value={stats.totalObjects.toLocaleString()} icon="📁" color="#F6821F" />
            <StatCard label="总存储量" value={stats.totalSizeFormatted} icon="💿" color="#3388BB" />
            <StatCard label="目录数" value={String(stats.byFolder.length)} icon="📂" color="#88C232" />
            <StatCard label="DB 头像记录" value={String(userAvatarCount)} icon="👤" color="#E8A040" />
          </div>

          {/* 配置信息 */}
          <div className="bg-white border rounded-lg p-3 mb-6 text-xs space-y-1" style={{ borderColor: "#D0DEE8", color: "#777" }}>
            <div>Bucket: <code style={{ color: "#333" }}>{bucketName}</code></div>
            <div>Public URL: <code style={{ color: "#333" }}>{publicUrl}</code></div>
            <div>Account ID: <code style={{ color: "#333" }}>{accountId?.slice(0, 12)}…</code></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 按目录 */}
            <div>
              <h2 className="text-lg font-semibold mb-3" style={{ color: "#25547A" }}>按目录</h2>
              <div className="bg-white border rounded-lg overflow-hidden" style={{ borderColor: "#D0DEE8" }}>
                <table className="w-full text-sm">
                  <thead style={{ background: "#F0F5FA" }}>
                    <tr>
                      <th className="text-left px-4 py-2 font-medium" style={{ color: "#555" }}>目录</th>
                      <th className="text-right px-4 py-2 font-medium" style={{ color: "#555" }}>文件数</th>
                      <th className="text-right px-4 py-2 font-medium" style={{ color: "#555" }}>大小</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.byFolder.map((f) => (
                      <tr key={f.folder} className="border-t" style={{ borderColor: "#E6F0F8" }}>
                        <td className="px-4 py-2 font-mono text-xs" style={{ color: "#333" }}>{f.folder}/</td>
                        <td className="px-4 py-2 text-right text-xs" style={{ color: "#555" }}>{f.count.toLocaleString()}</td>
                        <td className="px-4 py-2 text-right text-xs font-mono" style={{ color: "#555" }}>{f.sizeFormatted}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 按文件类型 */}
            <div>
              <h2 className="text-lg font-semibold mb-3" style={{ color: "#25547A" }}>按文件类型</h2>
              <div className="bg-white border rounded-lg overflow-hidden" style={{ borderColor: "#D0DEE8" }}>
                <table className="w-full text-sm">
                  <thead style={{ background: "#F0F5FA" }}>
                    <tr>
                      <th className="text-left px-4 py-2 font-medium" style={{ color: "#555" }}>类型</th>
                      <th className="text-right px-4 py-2 font-medium" style={{ color: "#555" }}>文件数</th>
                      <th className="text-right px-4 py-2 font-medium" style={{ color: "#555" }}>大小</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.byType.map((t) => (
                      <tr key={t.type} className="border-t" style={{ borderColor: "#E6F0F8" }}>
                        <td className="px-4 py-2 text-xs" style={{ color: "#333" }}>.{t.type}</td>
                        <td className="px-4 py-2 text-right text-xs" style={{ color: "#555" }}>{t.count.toLocaleString()}</td>
                        <td className="px-4 py-2 text-right text-xs font-mono" style={{ color: "#555" }}>{t.sizeFormatted}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: string; icon: string; color: string }) {
  return (
    <div className="bg-white border rounded-xl p-4 shadow-sm" style={{ borderColor: "#D0DEE8" }}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl">{icon}</span>
        <span className="text-xs" style={{ color: "#777" }}>{label}</span>
      </div>
      <div className="text-2xl font-bold" style={{ color }}>{value}</div>
    </div>
  );
}
