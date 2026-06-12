"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import MentionEditor from "@/components/MentionEditor";

interface EventImage {
  id?: string;
  url: string;
  altText?: string;
}

interface HistoryEvent {
  id: string;
  year: number;
  title: string;
  body?: string | null;
  eventDate?: string | null;
  sortOrder: number;
  images: EventImage[];
}

export default function AdminHistoryEventsPage() {
  const [events, setEvents] = useState<HistoryEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // 新建/编辑表单
  const [editing, setEditing] = useState<Partial<HistoryEvent> | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formBody, setFormBody] = useState("");
  const [formDate, setFormDate] = useState("");
  const [formImages, setFormImages] = useState<EventImage[]>([]);
  const [saving, setSaving] = useState(false);
  const [imgUploading, setImgUploading] = useState(false);
  const imgFileRef = useRef<HTMLInputElement>(null);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/history-events");
      if (res.ok) {
        const json = await res.json();
        setEvents(json.data ?? []);
      }
      else setError("加载失败");
    } catch { setError("网络错误"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  function openEdit(ev?: HistoryEvent) {
    if (ev) {
      setEditing(ev);
      setFormTitle(ev.title);
      setFormBody(ev.body || "");
      setFormDate(ev.eventDate ? ev.eventDate.slice(0, 10) : "");
      setFormImages(ev.images || []);
    } else {
      setEditing({});
      setFormTitle("");
      setFormBody("");
      setFormDate("");
      setFormImages([]);
    }
  }

  async function uploadImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImgUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("type", "screenshot");
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "上传失败");
      setFormImages((prev) => [...prev, { url: json.url }].slice(0, 5));
    } catch (err: any) {
      alert(err.message || "上传失败");
    } finally {
      setImgUploading(false);
      if (imgFileRef.current) imgFileRef.current.value = "";
    }
  }

  async function save() {
    if (!formTitle.trim() || !formDate) return alert("标题和日期为必填");
    setSaving(true);
    const year = new Date(formDate).getFullYear();
    try {
      const body = {
        title: formTitle,
        body: formBody || undefined,
        year,
        eventDate: formDate,
        images: formImages.map((img) => ({ url: img.url, altText: img.altText })),
      };
      const method = editing?.id ? "PATCH" : "POST";
      const url = editing?.id ? `/api/admin/history-events/${editing.id}` : "/api/admin/history-events";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j.error || "保存失败");
      }
      setEditing(null);
      fetchEvents();
    } catch (err: any) {
      alert(err.message || "保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function deleteEvent(id: string) {
    if (!confirm("确定删除此事件？")) return;
    try {
      const res = await fetch(`/api/admin/history-events/${id}`, { method: "DELETE" });
      if (res.ok) fetchEvents();
      else alert("删除失败");
    } catch { alert("网络错误"); }
  }

  const inputClass = "w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3388BB] focus:border-transparent";
  const inputStyle = { borderColor: "#D0DEE8", color: "#333" };
  const labelStyle: React.CSSProperties = { color: "#555", fontSize: "0.875rem", fontWeight: 500 };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" style={{ color: "#25547A" }}>历史事件管理</h1>
        <button onClick={() => openEdit()} className="px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ background: "#3388BB" }}>
          + 添加事件
        </button>
      </div>

      {error && <div className="p-3 rounded-lg text-sm" style={{ background: "#FDE8E8", color: "#C62828" }}>{error}</div>}

      {/* 编辑弹窗 */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/50">
          <div className="bg-white rounded-xl p-6 w-[95vw] max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4" style={{ color: "#25547A" }}>{editing.id ? "编辑事件" : "新建事件"}</h2>
            <div className="space-y-4">
              <div>
                <label style={labelStyle}>标题 *</label>
                <input value={formTitle} onChange={(e) => setFormTitle(e.target.value)} placeholder="事件标题" className={inputClass} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>正文</label>
                <MentionEditor value={formBody} onChange={setFormBody} rows={4} placeholder="详细描述..." className={inputClass} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>日期 *</label>
                <input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} className={inputClass} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>图片 ({formImages.length}/5)</label>
                <input ref={imgFileRef} type="file" accept="image/*" className="hidden" onChange={uploadImage} />
                {formImages.length > 0 && (
                  <div className="flex gap-2 mb-2 flex-wrap">
                    {formImages.map((img, i) => (
                      <div key={i} className="relative w-16 h-12 rounded overflow-hidden border" style={{ borderColor: "#D0DEE8" }}>
                        <img src={img.url} alt="" className="w-full h-full object-cover" />
                        <button onClick={() => setFormImages((prev) => prev.filter((_, j) => j !== i))}
                          className="absolute top-0 right-0 w-4 h-4 bg-red-500 text-white text-[10px] flex items-center justify-center rounded-bl">×</button>
                      </div>
                    ))}
                  </div>
                )}
                <button onClick={() => imgFileRef.current?.click()} disabled={formImages.length >= 5 || imgUploading}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50 text-white" style={{ background: "#88C232" }}>
                  {imgUploading ? "上传中..." : "+ 上传图片"}
                </button>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setEditing(null)} className="px-4 py-2 rounded-lg text-sm" style={{ color: "#777", border: "1px solid #D0DEE8" }}>取消</button>
              <button onClick={save} disabled={saving} className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50" style={{ background: "#3388BB" }}>
                {saving ? "保存中..." : "保存"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 事件列表 */}
      {loading ? (
        <div className="text-center py-10 text-sm" style={{ color: "#999" }}>加载中...</div>
      ) : events.length === 0 ? (
        <div className="text-center py-10 text-sm" style={{ color: "#999" }}>暂无事件</div>
      ) : (
        <div className="bg-white rounded-xl border" style={{ borderColor: "#D0DEE8" }}>
          {events.map((ev) => (
            <div key={ev.id} className="flex items-center justify-between p-4 border-b last:border-0" style={{ borderColor: "#EEE" }}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-0.5 rounded" style={{ background: "#E6F0F8", color: "#25547A" }}>{ev.year}</span>
                  <span className="text-sm font-medium truncate" style={{ color: "#333" }}>{ev.title}</span>
                  {ev.eventDate && <span className="text-xs" style={{ color: "#999" }}>{new Date(ev.eventDate).toLocaleDateString("zh-CN")}</span>}
                </div>
                {ev.body && <div className="text-xs mt-1 line-clamp-1" style={{ color: "#777" }}>{ev.body}</div>}
              </div>
              <div className="flex items-center gap-2 ml-4 shrink-0">
                {ev.images.length > 0 && <span className="text-xs" style={{ color: "#999" }}>🖼️{ev.images.length}</span>}
                <button onClick={() => openEdit(ev)} className="text-xs px-2 py-1 rounded hover:bg-gray-100" style={{ color: "#3388BB" }}>编辑</button>
                <button onClick={() => deleteEvent(ev.id)} className="text-xs px-2 py-1 rounded hover:bg-red-50" style={{ color: "#C62828" }}>删除</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
