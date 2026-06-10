"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function NavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(href + "/");

  return (
    <Link
      href={href}
      className={`hover:text-white transition-colors nav-link relative ${
        isActive ? "text-white font-medium" : "text-white/80"
      }`}
    >
      {children}
      {isActive && (
        <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-[#E38043] rounded-full" />
      )}
    </Link>
  );
}
