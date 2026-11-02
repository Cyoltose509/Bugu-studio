import type { Metadata } from "next";
import { auth } from "@/lib/auth/auth";
import { getLang } from "@/lib/i18n/getLang";
import { t } from "@/lib/i18n/dict";
import { getToolsData } from "@/lib/tools/tools";
import ToolsClient from "@/components/tools/ToolsClient";

export async function generateMetadata(): Promise<Metadata> {
    const lang = await getLang();
    return { title: t(lang, "page.tools.title"), description: t(lang, "page.tools.description") };
}

/**
 * 实用工具站导航 — 分栏 + 条目持久化在 SiteSetting（tools:sites），
 * 未配置时回退默认数据；管理员可管理分栏（新增/改名/删除）与条目（＋ 追加 / ✎ 编辑）。
 */
export default async function ToolsPage() {
    const [session, data] = await Promise.all([auth(), getToolsData()]);
    const isAdmin = session?.user?.role === "ADMIN";

    return <ToolsClient initialData={data} isAdmin={isAdmin} />;
}
