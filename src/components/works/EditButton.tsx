"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { canEditProject } from "@/lib/auth/rbac";
import { useLang } from "@/lib/i18n/LangProvider";
import { t } from "@/lib/i18n/dict";

export default function EditButton({ slug, submitterId }: { slug: string; submitterId: string }) {
  const { data: session } = useSession();
  const { lang } = useLang();
  const userRole = session?.user?.role as string | undefined;
  const userId = session?.user?.id;

  if (!userId) return null;

  const editable = canEditProject(userRole as any, userId, submitterId);
  if (!editable) return null;

  return (
    <div className="flex gap-2">
      <Link
        href={`/works/${slug}/edit`}
        className="inline-flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg font-medium transition-colors bg-brand-navy text-white"
      >
        ✏️ {t(lang, "works.edit.title")}
      </Link>
    </div>
  );
}
