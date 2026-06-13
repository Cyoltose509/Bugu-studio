import Image from "next/image";

/** 通用 Logo 加载组件 */
export default function LogoLoading({ text = "加载中..." }: { text?: string }) {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center">
      <div className="animate-pulse">
        <Image
          src="/images/logo.png"
          alt="布谷工作室"
          width={64}
          height={64}
          className="rounded-xl"
        />
      </div>
      <p className="mt-4 text-sm text-brand-text-muted">{text}</p>
    </div>
  );
}
