import Link from "next/link";
import UserAvatar from "@/components/ui/UserAvatar";
import CdnImage from "@/components/ui/CdnImage";
import { claimAssociations } from "./actions";

export type ClaimCandidate = {
  key: string;
  kind: string;
  name: string;
  title: string;
  subtitle?: string | null;
  coverImage?: string | null;
  href: string;
};

export default function ClaimsPanel({ user, name, candidates, error, success, preview = false }: {
  user: { id: string; name: string | null; email: string; image?: string | null; member?: { displayName: string } | null };
  name: string;
  candidates: ClaimCandidate[];
  error?: string;
  success?: string;
  preview?: boolean;
}) {
  return <div className="mx-auto max-w-5xl space-y-6 animate-fade-in">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><Link href="/admin/users" className="text-sm text-brand-blue hover:underline">← 用户管理</Link><div className="mt-2 flex items-center gap-3"><UserAvatar src={user.image} name={user.member?.displayName || user.name} size={36} /><h1 className="text-2xl font-bold text-brand-navy">认领社外成员关联</h1></div><p className="mt-1 text-sm text-brand-text-secondary">为 {user.member?.displayName || user.name || user.email} 关联此前以姓名记录的活动与作品。</p></div>
      <Link href={`/profile?id=${user.id}`} className="btn-secondary rounded-lg px-4 py-2 text-sm">查看用户主页</Link>
    </div>
    <form method="get" className="flex gap-2 rounded-xl border border-brand-border-subtle bg-card p-4 shadow-sm">
      <label className="sr-only" htmlFor="claim-name">原署名</label>
      <input id="claim-name" name="name" defaultValue={name} placeholder="输入完整的原署名或别名" maxLength={80} className="min-w-0 flex-1 rounded-lg border border-brand-border-subtle px-3 py-2 text-sm" />
      <button className="btn-primary rounded-lg px-5 py-2 text-sm">查找</button>
    </form>
    {error && <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error === "selection" ? "请选择 1 至 500 条有效记录。" : "记录已变化、重复关联或认领失败，请刷新后重试。"}</p>}
    {success && <p role="status" className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">已认领 {Number(success) || 0} 条关联。</p>}
    <form action={preview ? undefined : claimAssociations.bind(null, user.id)} className="overflow-hidden rounded-xl border border-brand-border-subtle bg-card shadow-sm">
      <input type="hidden" name="search" value={name} />
      <div className="border-b border-brand-border-subtle px-5 py-4"><h2 className="font-semibold text-brand-navy">同名待认领记录 <span className="text-sm font-normal text-brand-text-secondary">{candidates.length}</span></h2><p className="mt-1 text-xs text-brand-text-secondary">默认全选。请核对每张作品或活动卡片，不属于该用户的记录可取消勾选。</p></div>
      {candidates.length ? <div className="grid gap-3 p-4 sm:grid-cols-2">{candidates.map((item) => <article key={item.key} className="rounded-xl border border-brand-border-subtle bg-card p-3 transition-colors hover:border-brand-blue/50 hover:bg-brand-surface-page">
        <div className="flex items-start gap-3">
          <input type="checkbox" name="claim" value={item.key} defaultChecked aria-label={`认领${item.kind}：${item.title}`} className="mt-1 size-4 shrink-0 accent-brand-blue" />
          <Link href={item.href} target="_blank" className="relative h-20 w-24 shrink-0 overflow-hidden rounded-lg bg-brand-navy text-white" aria-label={`查看${item.title}`}>
            {item.coverImage ? <CdnImage src={item.coverImage} alt="" className="h-full w-full object-cover" /> : <span className="flex h-full w-full items-center justify-center text-sm font-medium opacity-80">{item.kind.includes("作品") ? "作品" : "活动"}</span>}
          </Link>
          <div className="min-w-0 flex-1">
            <span className="rounded bg-brand-surface-page px-1.5 py-0.5 text-xs text-brand-text-secondary">{item.kind}</span>
            <Link href={item.href} target="_blank" className="mt-1.5 block line-clamp-2 font-semibold leading-snug text-brand-navy hover:text-brand-blue">{item.title}</Link>
            {item.subtitle && <p className="mt-1 line-clamp-2 text-xs text-brand-text-secondary">{item.subtitle}</p>}
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-brand-border-subtle pt-2 text-xs text-brand-text-secondary">
          <span className="flex min-w-0 items-center gap-1.5"><UserAvatar src={null} name={item.name} size={20} /><span className="truncate">原署名：{item.name}</span></span>
          <Link href={item.href} target="_blank" className="shrink-0 text-brand-blue hover:underline">查看来源 ↗</Link>
        </div>
      </article>)}</div> : <p className="px-5 py-10 text-center text-sm text-brand-text-secondary">{name ? "没有找到未认领的相关记录，可尝试其他姓名或别名。" : "输入原署名后查找记录。"}</p>}
      {candidates.length > 0 && <div className="flex justify-end border-t border-brand-border-subtle px-5 py-4"><button type={preview ? "button" : "submit"} className="btn-primary rounded-lg px-5 py-2 text-sm">认领选中记录</button></div>}
    </form>
  </div>;
}
