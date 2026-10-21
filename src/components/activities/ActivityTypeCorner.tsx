const TONE: Record<string, string> = {
  MEETING: "bg-[#3B82C4]",
  COURSE: "bg-[#3D9B8F]",
  ENGINE_COURSE: "bg-[#236EAE]",
  COMPETITION: "bg-brand-orange",
  GENERAL: "bg-[#6D5B9A]",
};

/** 封面左上角三角角标：例会 / 大事件 / Game Jam / 公开课 */
export default function ActivityTypeCorner({
  type,
  label,
}: {
  type: string;
  label: string;
}) {
  const tone = TONE[type] || "bg-brand-navy";
  const compact = label.length > 5;

  return (
    <div className="absolute top-0 left-0 z-10 w-[6.75rem] h-[6.75rem] overflow-hidden pointer-events-none grayscale-0">
      <span
        className={`absolute top-[0.95rem] -left-[1.85rem] w-[8.4rem] py-px text-center font-extrabold leading-none text-white rotate-[-45deg] ${tone} ${
          compact ? "text-[14px] tracking-tight" : "text-[16px] tracking-wide"
        }`}
      >
        {label}
      </span>
    </div>
  );
}
