import { Providers } from "@/components/providers/Providers";

export default function MembersLayout({ children }: { children: React.ReactNode }) {
  return <Providers>{children}</Providers>;
}
