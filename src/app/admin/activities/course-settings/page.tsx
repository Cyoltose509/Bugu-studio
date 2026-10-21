import Link from "next/link";
import { getCourseMeetingVisibility } from "@/lib/activities/course-meeting-visibility";
import { saveCourseMeetingVisibility } from "./actions";

const OPTIONS = [
  { value: "HIDDEN", label: "不公开", note: "仅管理员可见" },
  { value: "MEMBERS", label: "仅成员可见", note: "关联社团成员的账号可见" },
  { value: "REGISTERED", label: "仅注册用户可见", note: "登录后可见" },
  { value: "PUBLIC", label: "完全公开", note: "所有访客可见" },
] as const;

export default async function CourseSettingsPage() {
  const visibility = await getCourseMeetingVisibility();
  return <main className="max-w-2xl space-y-6">
    <Link href="/admin/activities" className="text-sm text-brand-blue">← 活动管理</Link>
    <div><h1 className="text-2xl font-bold text-brand-navy">公开课会议链接</h1>
      <p className="mt-2 text-sm text-brand-text-secondary">统一控制两类公开课的活动链接和各课次会议链接。管理员始终可见。</p></div>
    <form action={saveCourseMeetingVisibility} className="rounded-xl border border-brand-border-subtle bg-card p-5 space-y-3">
      {OPTIONS.map((option) => <label key={option.value} className="flex gap-3 rounded-lg border border-brand-border-subtle p-3 cursor-pointer">
        <input type="radio" name="visibility" value={option.value} defaultChecked={visibility === option.value} className="accent-brand-blue" />
        <span><strong className="block text-brand-navy">{option.label}</strong><span className="text-xs text-brand-text-muted">{option.note}</span></span>
      </label>)}
      <button type="submit" className="btn-primary rounded-lg px-5 py-2 text-sm">保存设置</button>
    </form>
  </main>;
}
