import { notFound } from "next/navigation";
import PlusIcon from "@/components/ui/PlusIcon";

export const metadata = { title: "加号控件预览", robots: { index: false, follow: false } };

export default function PlusControlsPreview() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <main className="mx-auto max-w-xl space-y-6 px-6 py-12">
    <div>
      <p className="text-xs tracking-widest text-brand-orange">DESIGN PREVIEW</p>
      <h1 className="mt-2 text-2xl font-bold text-brand-navy">加号控件</h1>
    </div>
    <section className="flex items-center gap-8 rounded-2xl bg-[#E7F5F9] p-8">
      <button type="button" className="btn-primary brand-add-control" aria-label="新增"><PlusIcon size={24} /></button>
      <button type="button" className="btn-primary brand-add-control brand-add-control--compact" aria-label="新增紧凑版"><PlusIcon size={21} /></button>
      <button type="button" className="grid h-9 w-9 place-items-center rounded-lg border border-brand-blue/20 bg-brand-blue/10 text-brand-blue" aria-label="新增次级版"><PlusIcon size={18} /></button>
    </section>
  </main>;
}
