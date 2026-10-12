"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import type { Session } from "next-auth";
import { LangProvider } from "@/lib/i18n/LangProvider";
import type { Lang } from "@/lib/i18n/config";

export function Providers({
  children,
  session,
  initialLang,
}: {
  children: React.ReactNode;
  session?: Session | null;
  initialLang?: Lang;
}) {
  return (
    <LangProvider initialLang={initialLang}>
      <SessionProvider session={session}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
      </SessionProvider>
    </LangProvider>
  );
}
