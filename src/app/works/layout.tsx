import { Providers } from "@/components/providers/Providers";

export default function WorksLayout({ children }: { children: React.ReactNode }) {
  return <Providers>{children}</Providers>;
}
