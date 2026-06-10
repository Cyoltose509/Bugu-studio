"use client";

import { useState } from "react";

interface OrphanFile {
  key: string;
  size: number;
  sizeFormatted: string;
  lastModified: string | null;
  publicUrl: string;
}

export default function OrphanFilesDetector() {
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [orphans, setOrphans] = useState<OrphanFile[]>([]);
  const [totalObjects, setTotalObjects] = useState<number>(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<{
    deleted: number;
    errors: string[];
    stillExists?: string[];
    totalBefore?: number;
    totalAfter?: number;
    orphansBefore?: number;
    orphansAfter?: number;
  } | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [diagnosing, setDiagnosing] = useState(false);
  const [diagnosis, setDiagnosis] = useState<any>(null);

  // 图片扩展名集合
  const IMAGE_EXTS = new Set([
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".svg", ".ico", ".avif",
  ]);

  function isImage(key: string): boolean {
    const lower = key.toLowerCase();
    return [...IMAGE_EXTS].some((ext) => lower.endsWith(ext));
  }

  async function scan() {
    setLoading(true);
    setError(null);
    setOrphans([]);
    setSelected(new Set());
    setResult(null);

    try {
      const res = await fetch("/api/admin/r2/orphans");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "扫描失败");
      setOrphans(data.orphans || []);
      setTotalObjects(data.total || 0);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function diagnose() {
    setDiagnosing(true);
    setDiagnosis(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/r2/diagnose");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "诊断失败");
      setDiagnosis(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setDiagnosing(false);
    }
  }

  async function deleteSelected() {
    const keys = Array.from(selected);
    if (keys.length === 0) return;
    if (!confirm(`确定删除选中的 ${keys.length} 个文件？此操作不可撤销！`)) return;

    const totalBefore = totalObjects;
    const orphansBefore = orphans.length;

    setDeleting(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/r2/orphans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keys }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "删除失败");

      const failedKeys = new Set(
        data.results.filter((r: any) => !r.success).map((r: any) => r.key)
      );
      const successCount = data.results.filter((r: any) => r.success).length;
      const stillExistsList = data.results.filter((r: any) => r.stillExists).map((r: any) => r.key);

      // 删除后自动重扫验证
      setVerifying(true);
      let totalAfter = 0;
      let orphansAfter = 0;
      try {
        const verifyRes = await fetch("/api/admin/r2/orphans");
        const verifyData = await verifyRes.json();
        totalAfter = verifyData.total || 0;
        orphansAfter = (verifyData.orphans || []).length;
        setOrphans(verifyData.orphans || []);
        setTotalObjects(totalAfter);
      } catch {
        // 重扫失败不影响主流程，只保留删除失败的旧列表
        setOrphans((prev) => prev.filter((o) => failedKeys.has(o.key)));
      }
      setVerifying(false);

      setSelected(new Set());

      setResult({
        deleted: successCount,
        errors: data.results.filter((r: any) => !r.success).map((r: any) => `${r.key}: ${r.error}`),
        stillExists: stillExistsList,
        totalBefore,
        totalAfter,
        orphansBefore,
        orphansAfter,
      });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setDeleting(false);
    }
  }

  async function deleteAll() {
    if (orphans.length === 0) return;
    if (!confirm(`确定删除全部 ${orphans.length} 个野文件？此操作不可撤销！`)) return;

    const totalBefore = totalObjects;
    const orphansBefore = orphans.length;

    setDeleting(true);
    setError(null);
    const keys = orphans.map((o) => o.key);

    try {
      const res = await fetch("/api/admin/r2/orphans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keys }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "删除失败");

      const failedKeys = new Set(
        data.results.filter((r: any) => !r.success).map((r: any) => r.key)
      );
      const successCount = data.results.filter((r: any) => r.success).length;
      const stillExistsList = data.results.filter((r: any) => r.stillExists).map((r: any) => r.key);

      // 删除后自动重扫验证
      setVerifying(true);
      let totalAfter = 0;
      let orphansAfter = 0;
      try {
        const verifyRes = await fetch("/api/admin/r2/orphans");
        const verifyData = await verifyRes.json();
        totalAfter = verifyData.total || 0;
        orphansAfter = (verifyData.orphans || []).length;
        setOrphans(verifyData.orphans || []);
        setTotalObjects(totalAfter);
      } catch {
        setOrphans((prev) => prev.filter((o) => failedKeys.has(o.key)));
      }
      setVerifying(false);

      setSelected(new Set());

      setResult({
        deleted: successCount,
        errors: data.results.filter((r: any) => !r.success).map((r: any) => `${r.key}: ${r.error}`),
        stillExists: stillExistsList,
        totalBefore,
        totalAfter,
        orphansBefore,
        orphansAfter,
      });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setDeleting(false);
    }
  }

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function formatDate(iso: string | null) {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("zh-CN");
  }

  return (
    <div className="mt-8 bg-white border rounded-xl p-5 shadow-sm" style={{ borderColor: "#D0DEE8" }}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold" style={{ color: "#25547A" }}>
          🧹 R2 野文件检测
        </h2>
        <button
          onClick={scan}
          disabled={loading}
          className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
          style={{ background: loading ? "#999" : "#F6821F" }}
        >
          {loading ? (
            <span className="inline-flex items-center gap-1">
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
                <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
              扫描中…
            </span>
          ) : (
            "🔍 检测野文件"
          )}
        </button>
        <button
          onClick={diagnose}
          disabled={diagnosing}
          className="px-3 py-2 rounded-lg text-sm font-medium border disabled:opacity-50"
          style={{ borderColor: "#3388BB", color: "#3388BB" }}
          title="诊断 R2 文件数与 Cloudflare Dashboard 的差异"
        >
          {diagnosing ? (
            <span className="inline-flex items-center gap-1">
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
                <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
              诊断中…
            </span>
          ) : (
            "🩺 诊断"
          )}
        </button>
      </div>

      <p className="text-xs mb-4" style={{ color: "#777" }}>
        扫描 R2 存储桶，找出数据库中没有任何引用的文件（野文件），可安全删除。
      </p>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm" style={{ color: "#C62828" }}>
          {error}
        </div>
      )}

      {diagnosis && (
        <div className="mb-4 border rounded-lg p-4 text-sm" style={{ borderColor: diagnosis.multipartUploads?.totalSize > 0 ? "#FFB347" : "#88C232", background: diagnosis.multipartUploads?.totalSize > 0 ? "#FFF8E1" : "#F1F8E9" }}>
          <div className="font-semibold mb-2" style={{ color: "#25547A" }}>🩺 R2 诊断报告</div>

          <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
            <div className="p-2 rounded" style={{ background: "#E8F4FD" }}>
              <div className="font-medium" style={{ color: "#3388BB" }}>ListObjectsV2 扫描</div>
              <div style={{ color: "#555" }}>{diagnosis.objects.count.toLocaleString()} 个文件，{diagnosis.objects.sizeFormatted}</div>
              <div style={{ color: "#999" }}>扫描 {diagnosis.objects.listPages} 页，IsTruncated: {diagnosis.objects.isTruncated ? "是 ⚠️" : "否 ✅"}</div>
            </div>
            <div className="p-2 rounded" style={{ background: diagnosis.multipartUploads?.totalSize > 0 ? "#FFF3E0" : "#E8F5E9" }}>
              <div className="font-medium" style={{ color: diagnosis.multipartUploads?.totalSize > 0 ? "#E38043" : "#2E7D32" }}>
                未完成分片上传
              </div>
              <div style={{ color: "#555" }}>
                {diagnosis.multipartUploads?.count} 个上传，{diagnosis.multipartUploads?.totalSizeFormatted}
                （{diagnosis.multipartUploads?.totalParts} 个分片）
              </div>
            </div>
          </div>

          <div className="p-2 rounded text-xs font-medium" style={{ background: "#F0F5FA", color: "#25547A" }}>
            合计（对象 + 分片碎片）：{diagnosis.combined.totalSizeFormatted}
            {diagnosis.multipartUploads?.totalSize > 0 && (
              <span className="ml-1" style={{ color: "#E38043" }}>
                — 其中 {diagnosis.multipartUploads.totalSizeFormatted} 为无法直接访问的碎片
              </span>
            )}
          </div>

          <div className="mt-2 text-xs" style={{ color: "#777" }}>{diagnosis.note}</div>

          {diagnosis.multipartUploads?.uploads?.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs" style={{ color: "#3388BB" }}>
                查看分片上传详情（{Math.min(diagnosis.multipartUploads.uploads.length, 100)} 条）
              </summary>
              <div className="mt-2 max-h-40 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ color: "#777" }}>
                      <th className="text-left py-1">文件</th>
                      <th className="text-right py-1">分片数</th>
                      <th className="text-right py-1">大小</th>
                      <th className="text-right py-1">发起时间</th>
                    </tr>
                  </thead>
                  <tbody>
                    {diagnosis.multipartUploads.uploads.map((u: any) => (
                      <tr key={u.uploadId} className="border-t" style={{ borderColor: "#E6F0F8" }}>
                        <td className="py-1 font-mono truncate max-w-[200px]" title={u.key}>{u.key}</td>
                        <td className="text-right py-1">{u.parts}</td>
                        <td className="text-right py-1">{u.partsSizeFormatted}</td>
                        <td className="text-right py-1" style={{ color: "#999" }}>{new Date(u.initiated).toLocaleString("zh-CN")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}
        </div>
      )}

      {result && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4 text-sm" style={{ color: "#2E7D32" }}>
          <div className="font-medium mb-1">成功删除 {result.deleted} 个文件</div>
          {result.totalBefore !== undefined && result.totalAfter !== undefined && (
            <div className="text-xs mb-1" style={{ color: "#555" }}>
              R2 文件总数：{result.totalBefore.toLocaleString()} → {result.totalAfter.toLocaleString()}
              （减少 {result.totalBefore - result.totalAfter}）
            </div>
          )}
          {result.orphansBefore !== undefined && result.orphansAfter !== undefined && (
            <div className="text-xs mb-1" style={{ color: "#555" }}>
              野文件数：{result.orphansBefore} → {result.orphansAfter}
              {result.orphansAfter === 0 ? " ✅ 已全部清理" : ` ⚠️ 还有 ${result.orphansAfter} 个`}
            </div>
          )}
          {verifying && (
            <div className="text-xs mt-1 flex items-center gap-1" style={{ color: "#999" }}>
              <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
                <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
              正在重新扫描 R2 以确认删除…
            </div>
          )}
          {result.stillExists && result.stillExists.length > 0 && (
            <div className="mt-2 text-xs" style={{ color: "#C62828" }}>
              ⚠️ 以下文件删除后仍存在（R2 未删除，需排查）：{result.stillExists.join("、")}
            </div>
          )}
          {result.errors.length > 0 && (
            <div className="mt-2 text-xs" style={{ color: "#C62828" }}>
              失败：{result.errors.join("；")}
            </div>
          )}
        </div>
      )}

      {orphans.length > 0 && (
        <>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-sm font-medium" style={{ color: "#555" }}>
              找到 {orphans.length} 个野文件（共 {orphans.reduce((s, o) => s + o.size, 0).toLocaleString()} 字节）
              {totalObjects > 0 && (
                <span className="text-xs ml-1" style={{ color: "#999" }}>
                  / R2 共 {totalObjects.toLocaleString()} 个文件
                </span>
              )}
            </span>
            <button
              onClick={() => setSelected(new Set(orphans.map((o) => o.key)))}
              className="text-xs underline"
              style={{ color: "#3388BB" }}
            >
              全选
            </button>
            <button
              onClick={() => setSelected(new Set())}
              className="text-xs underline"
              style={{ color: "#3388BB" }}
            >
              取消全选
            </button>
            <button
              onClick={deleteSelected}
              disabled={selected.size === 0 || deleting}
              className="ml-auto px-3 py-1 rounded-lg text-xs font-medium text-white disabled:opacity-50"
              style={{ background: selected.size > 0 && !deleting ? "#C62828" : "#999" }}
            >
              {deleting ? "删除中…" : `删除选中 (${selected.size})`}
            </button>
            <button
              onClick={deleteAll}
              disabled={deleting}
              className="px-3 py-1 rounded-lg text-xs font-medium border disabled:opacity-50"
              style={{ borderColor: "#C62828", color: "#C62828" }}
            >
              全部删除
            </button>
          </div>

          <div className="overflow-x-auto border rounded-lg" style={{ borderColor: "#E6F0F8" }}>
            <table className="w-full text-sm">
              <thead style={{ background: "#F0F5FA" }}>
                <tr>
                  <th className="px-3 py-2 w-8">
                    <input
                      type="checkbox"
                      checked={selected.size === orphans.length && orphans.length > 0}
                      onChange={() => {
                        if (selected.size === orphans.length) {
                          setSelected(new Set());
                        } else {
                          setSelected(new Set(orphans.map((o) => o.key)));
                        }
                      }}
                    />
                  </th>
                  <th className="text-center px-2 py-2 w-16 font-medium" style={{ color: "#555" }}>预览</th>
                  <th className="text-left px-3 py-2 font-medium" style={{ color: "#555" }}>文件路径</th>
                  <th className="text-right px-3 py-2 font-medium" style={{ color: "#555" }}>大小</th>
                  <th className="text-left px-3 py-2 font-medium" style={{ color: "#555" }}>最后修改</th>
                </tr>
              </thead>
              <tbody>
                {orphans.map((o) => (
                  <tr key={o.key} className="border-t" style={{ borderColor: "#E6F0F8" }}>
                    <td className="px-3 py-2"><input type="checkbox" checked={selected.has(o.key)} onChange={() => toggle(o.key)} /></td>
                    <td className="px-2 py-2 text-center">
                      {isImage(o.key) ? (
                        <img
                          src={o.publicUrl}
                          alt={o.key.split("/").pop()}
                          className="w-10 h-10 object-cover rounded border cursor-pointer hover:scale-110 transition"
                          style={{ borderColor: "#D0DEE8" }}
                          onClick={() => setLightboxUrl(o.publicUrl)}
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                      ) : (
                        <span className="text-xs" style={{ color: "#ccc" }}>—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs truncate max-w-xs" style={{ color: "#333" }} title={o.key}>{o.key}</td>
                    <td className="px-3 py-2 text-right text-xs font-mono" style={{ color: "#555" }}>{o.sizeFormatted}</td>
                    <td className="px-3 py-2 text-xs" style={{ color: "#777" }}>{formatDate(o.lastModified)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!loading && orphans.length === 0 && !error && !result && (
        <div className="text-center py-6 text-sm" style={{ color: "#999" }}>
          点击「检测野文件」开始扫描
        </div>
      )}

      {/* 灯箱 — 点击缩略图放大查看 */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          onClick={() => setLightboxUrl(null)}
        >
          <div className="relative max-w-3xl max-h-[90vh] p-4">
            <button
              onClick={() => setLightboxUrl(null)}
              className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-white/90 shadow-lg flex items-center justify-center text-gray-600 hover:text-black text-lg font-bold z-10"
              title="关闭"
            >
              ×
            </button>
            <img
              src={lightboxUrl}
              alt="预览大图"
              className="max-w-full max-h-[85vh] rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
}
