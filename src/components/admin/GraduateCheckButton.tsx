"use client";

import {useState, useCallback} from "react";
import {useRouter} from "next/navigation";

interface Suspect {
    id: string;
    displayName: string;
    grade: number | null;
    joinYear: number | null;
    user: { email: string };
}

export default function GraduateCheckButton() {
    const [open, setOpen] = useState(false);
    const [suspects, setSuspects] = useState<Suspect[]>([]);
    const [threshold, setThreshold] = useState(0);
    const [currentYear, setCurrentYear] = useState(0);
    const [loading, setLoading] = useState(false);
    const [confirming, setConfirming] = useState<Set<string>>(new Set());
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [resultMsg, setResultMsg] = useState("");
    const router = useRouter();

    const handleCheck = useCallback(async () => {
        setLoading(true);
        setResultMsg("");
        setSelected(new Set());
        try {
            const res = await fetch("/api/admin/members/graduate-check");
            const json = await res.json();
            if (!res.ok) {
                setResultMsg(json.error || "检测失败");
                return;
            }
            const data = json.data || json;
            setSuspects(data.suspects || []);
            setThreshold(data.threshold);
            setCurrentYear(data.currentYear);
            setOpen(true);
        } catch {
            setResultMsg("网络错误");
        } finally {
            setLoading(false);
        }
    }, []);

    const toggleSelect = (id: string) => {
        setSelected(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const selectAll = () => setSelected(new Set(suspects.map(s => s.id)));
    const deselectAll = () => setSelected(new Set());

    const confirmSelected = useCallback(async () => {
        const ids = [...selected];
        if (ids.length === 0) return;
        setConfirming(new Set(ids));
        try {
            const res = await fetch("/api/admin/members/graduate-confirm", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({memberIds: ids}),
            });
            const json = await res.json();
            if (!res.ok) {
                setResultMsg(json.error || "确认失败");
                return;
            }
            const data = json.data || json;
            // 移除已确认的
            setSuspects(prev => prev.filter(s => !selected.has(s.id)));
            setSelected(new Set());
            setResultMsg(`已确认 ${data.updated} 人毕业`);
            router.refresh();
        } catch {
            setResultMsg("网络错误");
        } finally {
            setConfirming(new Set());
        }
    }, [selected, router]);

    const confirmOne = useCallback(async (id: string) => {
        setConfirming(prev => new Set(prev).add(id));
        try {
            const res = await fetch("/api/admin/members/graduate-confirm", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({memberIds: [id]}),
            });
            const json = await res.json();
            if (!res.ok) {
                setResultMsg(json.error || "确认失败");
                return;
            }
            setSuspects(prev => prev.filter(s => s.id !== id));
            setSelected(prev => {
                const n = new Set(prev);
                n.delete(id);
                return n;
            });
            setResultMsg("已确认毕业");
            router.refresh();
        } catch {
            setResultMsg("网络错误");
        } finally {
            setConfirming(prev => {
                const n = new Set(prev);
                n.delete(id);
                return n;
            });
        }
    }, [router]);

    return (
        <>
            <div className="flex items-center gap-3">
                <button
                    type="button"
                    onClick={handleCheck}
                    disabled={loading}
                    className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50 bg-brand-orange hover:bg-brand-orange/80 transition-colors"
                >
                    {loading ? "检测中..." : "🎓 一键检测毕业"}
                </button>
                {resultMsg && !open && (
                    <span className="text-sm text-brand-text-secondary">{resultMsg}</span>
                )}
            </div>

            {/* ─── 弹窗 ─── */}
            {open && (
                <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh]">
                    {/* 遮罩 */}
                    <div className="absolute inset-0 bg-black/40" onClick={() => {
                        setOpen(false);
                        setResultMsg("");
                    }}/>

                    {/* 面板 */}
                    <div
                        className="relative bg-card rounded-xl border shadow-xl w-full max-w-lg mx-4 max-h-[70vh] flex flex-col border-brand-border-subtle">
                        {/* 头部 */}
                        <div className="flex items-center justify-between p-4 border-b border-brand-border-subtle">
                            <div>
                                <h2 className="text-base font-semibold text-brand-navy">🎓 毕业检测</h2>
                                <p className="text-xs text-brand-text-muted mt-0.5">
                                    {currentYear} 年 · 入学年份 &le; {threshold} 年（{currentYear - threshold}+ 年前入学）的可疑成员
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setOpen(false);
                                    setResultMsg("");
                                }}
                                className="text-brand-text-muted hover:text-brand-text-heading text-lg px-1"
                            >
                                ✕
                            </button>
                        </div>

                        {/* 列表 */}
                        <div className="flex-1 overflow-y-auto p-4">
                            {suspects.length === 0 ? (
                                <div className="text-center py-8 text-sm text-brand-text-secondary">
                                    🎉 没有可疑毕业成员，全员在读！
                                </div>
                            ) : (
                                <>
                                    {/* 工具栏 */}
                                    <div className="flex items-center gap-3 mb-3">
                                        <button type="button" onClick={selectAll} className="text-xs text-brand-blue hover:underline">全选
                                        </button>
                                        <button type="button" onClick={deselectAll}
                                                className="text-xs text-brand-text-muted hover:underline">取消
                                        </button>
                                        <span className="text-xs text-brand-text-muted">已选 {selected.size}/{suspects.length}</span>
                                    </div>

                                    <div className="space-y-2">
                                        {suspects.map(s => (
                                            <label
                                                key={s.id}
                                                className="flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer hover:bg-brand-surface border-brand-border-subtle"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={selected.has(s.id)}
                                                    onChange={() => toggleSelect(s.id)}
                                                    className="w-4 h-4 rounded accent-brand-navy cursor-pointer shrink-0"
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-medium text-sm text-brand-text-heading">{s.displayName}</div>
                                                    <div className="text-xs text-brand-text-muted">
                                                        入学 {s.grade ?? "?"} 级 · 入社 {s.joinYear ?? "?"} 年 · {s.user.email}
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        confirmOne(s.id);
                                                    }}
                                                    disabled={confirming.has(s.id)}
                                                    className="text-xs px-2.5 py-1 rounded border transition-colors shrink-0 disabled:opacity-50 border-brand-border-subtle hover:border-brand-orange hover:text-brand-orange text-brand-text-muted"
                                                >
                                                    {confirming.has(s.id) ? "..." : "确认毕业"}
                                                </button>
                                            </label>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>

                        {/* 底部操作栏 */}
                        {suspects.length > 0 && (
                            <div className="p-4 border-t flex items-center justify-between border-brand-border-subtle">
                                {resultMsg && <span className="text-xs text-brand-text-secondary">{resultMsg}</span>}
                                <div className="flex gap-2 ml-auto">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setOpen(false);
                                            setResultMsg("");
                                        }}
                                        className="px-3 py-1.5 rounded-lg text-sm border transition-colors border-brand-border-subtle text-brand-text-body hover:bg-brand-surface"
                                    >
                                        关闭
                                    </button>
                                    <button
                                        type="button"
                                        onClick={confirmSelected}
                                        disabled={selected.size === 0 || confirming.size > 0}
                                        className="px-4 py-1.5 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50 bg-brand-orange hover:bg-brand-orange/80"
                                    >
                                        {confirming.size > 0 ? "确认中..." : `全部确认（${selected.size}）`}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}
