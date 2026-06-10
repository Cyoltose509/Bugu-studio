"use client";

import {useState, useCallback, useEffect} from "react";
import {useSession} from "next-auth/react";

interface CommentUser {
    id: string;
    name?: string | null;
    image?: string | null;
}

interface Comment {
    id: string;
    content: string;
    createdAt: string;
    user: CommentUser;
    replyCount: number;
    replies: Comment[];
}

interface Props {
    projectId: string;
}

function Avatar({user}: { user: CommentUser }) {
    const initial = (user.name || "?")[0];
    if (user.image) {
        return (
            <img src={user.image} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" referrerPolicy="no-referrer"/>
        );
    }
    return (
        <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs shrink-0"
             style={{background: "#E38043"}}>
            {initial}
        </div>
    );
}

function formatTime(iso: string) {
    const d = new Date(iso);
    const now = new Date();
    const diff = (now.getTime() - d.getTime()) / 60000;
    if (diff < 1) return "刚刚";
    if (diff < 60) return `${Math.floor(diff)}分钟前`;
    if (diff < 1440) return `${Math.floor(diff / 60)}小时前`;
    return d.toLocaleDateString("zh-CN");
}

function CommentCard({c, isReply = false, session, canOperate, replyingTo, replyContent, submitting, onReplyToggle, onReplyChange, onReplySubmit, onDelete}: {
    c: Comment;
    isReply?: boolean;
    session: any;
    canOperate: boolean;
    replyingTo: string | null;
    replyContent: string;
    submitting: boolean;
    onReplyToggle: (id: string) => void;
    onReplyChange: (value: string) => void;
    onReplySubmit: (parentId: string) => void;
    onDelete: (id: string) => void;
}) {
    const isMine = session?.user?.id === c.user.id;
    return (
        <div className={`${isReply ? "ml-6 pl-3 border-l-2" : "py-3"} rounded-lg`}
             style={isReply ? {borderColor: "#E8F0F8"} : {}}>
            <div className="flex items-start gap-2.5">
                <Avatar user={c.user}/>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-medium" style={{color: "#25547A"}}>{c.user.name || "匿名"}</span>
                        <span className="text-xs" style={{color: "#999"}}>{formatTime(c.createdAt)}</span>
                    </div>
                    <p className="text-sm mt-0.5 whitespace-pre-wrap break-words" style={{color: "#444"}}>{c.content}</p>
                    {canOperate && (
                        <div className="flex items-center gap-3 mt-1.5">
                            <button
                                onClick={() => onReplyToggle(c.id)}
                                className="text-xs inline-flex items-center gap-1 hover:underline transition-colors"
                                style={{color: replyingTo === c.id ? "#3388BB" : "#999"}}
                                title="回复"
                            >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                                </svg>
                                回复
                            </button>
                            {isMine && (
                                <button
                                    onClick={() => onDelete(c.id)}
                                    className="text-xs inline-flex items-center gap-1 hover:underline transition-colors"
                                    style={{color: "#bbb"}}
                                    title="删除"
                                >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path
                                            d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14"/>
                                    </svg>
                                    删除
                                </button>
                            )}
                        </div>
                    )}
                    {/* 回复表单 */}
                    {replyingTo === c.id && (
                        <div className="mt-2 flex gap-2">
                            <input value={replyContent} onChange={(e) => onReplyChange(e.target.value)}
                                   maxLength={300}
                                   placeholder={`回复 ${c.user.name || "Ta"}...`}
                                   className="flex-1 text-xs px-2 py-1.5 rounded border focus:outline-none focus:ring-1 focus:ring-[#3388BB]"
                                   style={{borderColor: "#D0DEE8"}}/>
                            <button onClick={() => onReplySubmit(c.id)} disabled={!replyContent.trim() || submitting}
                                    className="text-xs px-3 py-1.5 rounded text-white disabled:opacity-40 transition-opacity"
                                    style={{background: "#3388BB"}}>发送
                            </button>
                            <button onClick={() => onReplyToggle(c.id)}
                                    className="text-xs px-2 py-1.5 rounded" style={{color: "#999"}}>取消
                            </button>
                        </div>
                    )}
                </div>
            </div>
            {/* 回复列表 */}
            {c.replies && c.replies.length > 0 && (
                <div className="mt-2 space-y-2">
                    {c.replies.map((r) => <CommentCard key={r.id} c={r} isReply={true}
                        session={session} canOperate={canOperate}
                        replyingTo={replyingTo} replyContent={replyContent}
                        submitting={submitting}
                        onReplyToggle={onReplyToggle} onReplyChange={onReplyChange}
                        onReplySubmit={onReplySubmit} onDelete={onDelete}
                    />)}
                </div>
            )}
        </div>
    );
}

export default function CommentSection({projectId}: Props) {
    const {data: session} = useSession();
    const isLoggedIn = !!session?.user;
    const canOperate = isLoggedIn && session.user.role !== "GUEST";

    const [comments, setComments] = useState<Comment[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [newContent, setNewContent] = useState("");
    const [replyingTo, setReplyingTo] = useState<string | null>(null);
    const [replyContent, setReplyContent] = useState("");

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/projects/${projectId}/comments`);
            const json = await res.json();
            if (json.success) setComments(json.data || []);
        } finally {
            setLoading(false);
        }
    }, [projectId]);

    useEffect(() => {
        load();
    }, [load]);

    async function submitComment(parentId?: string) {
        const content = parentId ? replyContent.trim() : newContent.trim();
        if (!content || content.length > 300) return;
        setSubmitting(true);
        try {
            const res = await fetch(`/api/projects/${projectId}/comments`, {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({content, parentId: parentId || undefined}),
            });
            const json = await res.json();
            if (res.ok && json.success) {
                setNewContent("");
                setReplyContent("");
                setReplyingTo(null);
                
                // 乐观更新：立即插入新评论到本地状态
                const newComment: Comment = {
                    id: json.data.id,
                    content: json.data.content,
                    createdAt: json.data.createdAt,
                    user: json.data.user,
                    replyCount: 0,
                    replies: [],
                };
                
                if (parentId) {
                    // 嵌套回复：插入到父评论的 replies 中
                    setComments(prev => prev.map(c => {
                        if (c.id === parentId) {
                            return { ...c, replies: [...c.replies, newComment], replyCount: c.replyCount + 1 };
                        }
                        // 也可能回复的是二级评论
                        return {
                            ...c,
                            replies: c.replies.map(r => {
                                if (r.id === parentId) {
                                    return { ...r, replies: [...(r.replies || []), newComment] };
                                }
                                return r;
                            }),
                        };
                    }));
                } else {
                    // 顶层评论：插入到列表顶部
                    setComments(prev => [newComment, ...prev]);
                }
                
                // 后台刷新确保与服务端一致
                setTimeout(() => load(), 500);
            }
        } finally {
            setSubmitting(false);
        }
    }

    async function deleteComment(commentId: string) {
        if (!confirm("确定删除这条留言？")) return;

        // 乐观删除：立即从本地状态中移除
        setComments(prev => removeCommentById(prev, commentId));

        const res = await fetch(`/api/projects/${projectId}/comments`, {
            method: "PATCH",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({commentId, action: "delete"}),
        });
        // 后台刷新确保与服务端一致
        if (res.ok) {
            setTimeout(() => load(), 500);
        }
    }

    /** 递归从评论树中移除指定 ID 的评论，返回新数组 */
    function removeCommentById(list: Comment[], targetId: string): Comment[] {
        return list
            .filter(c => c.id !== targetId)
            .map(c => ({
                ...c,
                replies: c.replies ? removeCommentById(c.replies, targetId) : [],
                replyCount: c.replies ? c.replies.filter(r => r.id !== targetId).length : c.replyCount,
            }));
    }

    const handleReplyToggle = useCallback((id: string) => {
        setReplyingTo(prev => prev === id ? null : id);
    }, []);

    const handleReplyChange = useCallback((value: string) => {
        setReplyContent(value);
    }, []);

    const handleReplySubmit = useCallback((parentId: string) => {
        submitComment(parentId);
    }, [replyContent, submitting]);

    const handleDelete = useCallback((id: string) => {
        deleteComment(id);
    }, []);

    return (
        <section className="mt-8">
            <h2 className="text-lg font-semibold mb-4" style={{color: "#25547A"}}>
                留言板（{comments.reduce((s, c) => s + 1 + (c.replies?.length || 0), 0)} 条）
            </h2>

            {/* 发表留言 */}
            {canOperate && (
                <div className="mb-4">
                    <div className="flex gap-2">
            <textarea value={newContent} onChange={(e) => setNewContent(e.target.value)}
                      maxLength={300} rows={2}
                      placeholder="写下你的留言…（最多300字）"
                      className="flex-1 text-sm px-3 py-2 rounded-lg border resize-none focus:outline-none focus:ring-1 focus:ring-[#3388BB]"
                      style={{borderColor: "#D0DEE8"}}/>
                        <button onClick={() => submitComment()} disabled={!newContent.trim() || submitting}
                                className="self-end px-4 py-2 rounded-lg text-sm text-white disabled:opacity-40 transition-opacity"
                                style={{background: "#25547A"}}>
                            {submitting ? "发送中…" : "发表"}
                        </button>
                    </div>
                    <div className="text-right text-xs mt-1" style={{color: "#999"}}>
                        {newContent.length}/300
                    </div>
                </div>
            )}
            {!isLoggedIn && (
                <p className="text-xs mb-3" style={{color: "#999"}}>请登录后发表留言</p>
            )}

            {/* 留言列表 */}
            {loading ? (
                <p className="text-xs" style={{color: "#999"}}>加载中…</p>
            ) : comments.length === 0 ? (
                <p className="text-xs" style={{color: "#999"}}>暂无留言，来抢沙发吧～</p>
            ) : (
                <div className="space-y-1 divide-y" style={{borderColor: "#F0F0F0"}}>
                    {comments.map((c) => (
                        <div key={c.id} className="first:pt-0 pt-3">
                            <CommentCard
                                c={c}
                                session={session}
                                canOperate={canOperate}
                                replyingTo={replyingTo}
                                replyContent={replyContent}
                                submitting={submitting}
                                onReplyToggle={handleReplyToggle}
                                onReplyChange={handleReplyChange}
                                onReplySubmit={handleReplySubmit}
                                onDelete={handleDelete}
                            />
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
}
