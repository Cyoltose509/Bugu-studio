import type { Metadata } from "next";
import { auth } from "@/lib/auth/auth";
import { getLang } from "@/lib/i18n/getLang";
import { t } from "@/lib/i18n/dict";
import { getToolSites } from "@/lib/tools/tools";
import ToolsClient from "@/components/tools/ToolsClient";

export async function generateMetadata(): Promise<Metadata> {
    const lang = await getLang();
    return { title: t(lang, "page.tools.title"), description: t(lang, "page.tools.description") };
}

/**
 * 实用工具站导航 — 条目持久化在 SiteSetting（tools:sites），
 * 未配置时回退默认条目；管理员可 ＋ 追加 / ✎ 编辑（ToolsClient）。
 */
export default async function ToolsPage() {
    const [session, sites] = await Promise.all([auth(), getToolSites()]);
    const isAdmin = session?.user?.role === "ADMIN";

    return <ToolsClient initialSites={sites} isAdmin={isAdmin} />;
}
