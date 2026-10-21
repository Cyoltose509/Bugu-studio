"use client";

/** 活动时间：指定日期，或标为待定。待定不提交具体日期。 */
export default function ActivityTimeChoice({
  pending,
  onPendingChange,
  start,
  end,
  onStartChange,
  onEndChange,
  fieldClass,
  labelClass,
}: {
  pending: boolean;
  onPendingChange: (next: boolean) => void;
  start: string;
  end: string;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
  fieldClass: string;
  labelClass: string;
}) {
  const choice = (active: boolean) =>
    `w-full px-3 py-2 rounded-lg text-sm border transition-all ${
      active
        ? "border-brand-blue bg-brand-blue/10 text-brand-blue ring-1 ring-brand-blue font-medium"
        : "border-brand-border-subtle text-brand-text-secondary bg-card hover:border-brand-blue/40"
    }`;

  return (
    <div className="space-y-3">
      <div>
        <p className={labelClass}>时间</p>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => onPendingChange(false)} className={choice(!pending)}>
            指定日期
          </button>
          <button type="button" onClick={() => onPendingChange(true)} className={choice(pending)}>
            待定
          </button>
        </div>
        {pending && <input type="hidden" name="timePending" value="on" />}
        {pending && (
          <p className="text-xs mt-2 text-brand-text-muted">不填具体日期。前台按即将开始展示，并排在最新一档。</p>
        )}
      </div>

      <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4 ${pending ? "opacity-50" : ""}`}>
        <div>
          <label className={labelClass} htmlFor="startTime">开始日期{pending ? "" : " *"}</label>
          <input
            id="startTime"
            name="startTime"
            type="date"
            required={!pending}
            disabled={pending}
            value={start}
            onChange={(e) => onStartChange(e.target.value)}
            className={fieldClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="endTime">结束日期{pending ? "" : " *"}</label>
          <input
            id="endTime"
            name="endTime"
            type="date"
            required={!pending}
            disabled={pending}
            value={end}
            onChange={(e) => onEndChange(e.target.value)}
            className={fieldClass}
          />
        </div>
      </div>
    </div>
  );
}
