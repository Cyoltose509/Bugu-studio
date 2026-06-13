"use client";

import { useState, useTransition } from "react";
import { submitCourseScore } from "@/lib/actions/judging";

const DIMENSIONS = [
  { key: "content", label: "📝 内容质量", desc: "讲题深度、知识准确性、结构逻辑" },
  { key: "delivery", label: "🎤 讲解表达", desc: "语言流畅度、互动性、时间把控" },
  { key: "preparation", label: "📋 准备充分度", desc: "资料齐备、案例丰富、PPT/演示质量" },
] as const;

const QUICK_SCORES = [50, 60, 70, 80, 90];

function ScoreSlider({
  label,
  desc,
  value,
  onChange,
  disabled,
}: {
  label: string;
  desc: string;
  value: number;
  onChange: (v: number) => void;
  disabled: boolean;
}) {
  const pct = Math.min(100, Math.max(0, value));
  const trackColor =
    pct < 35 ? "#e57373" : pct < 65 ? "#FFB347" : "#88C232";

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div>
          <span className="text-xs font-medium" style={{ color: "#555" }}>{label}</span>
          <span className="text-[10px] ml-1.5" style={{ color: "#aaa" }}>{desc}</span>
        </div>
        <span
          className="text-sm font-bold tabular-nums min-w-[2rem] text-right"
          style={{ color: trackColor }}
        >
          {value}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[10px]" style={{ color: "#ccc" }}>0</span>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          disabled={disabled}
          className="flex-1 h-2 rounded-full appearance-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            background: `linear-gradient(to right, ${trackColor} 0%, ${trackColor} ${pct}%, #e0e0e0 ${pct}%, #e0e0e0 100%)`,
            accentColor: trackColor,
          }}
        />
        <span className="text-[10px]" style={{ color: "#ccc" }}>100</span>
      </div>
    </div>
  );
}

export function SubmitCourseScoreForm({
  activityId,
  teamId,
  myScore,
}: {
  activityId: string;
  teamId: string;
  myScore: any;
}) {
  const [isPending, startTransition] = useTransition();
  const criteria = (myScore?.criteria || {}) as Record<string, number>;

  const [content, setContent] = useState(criteria.content ?? 0);
  const [delivery, setDelivery] = useState(criteria.delivery ?? 0);
  const [preparation, setPreparation] = useState(criteria.preparation ?? 0);

  const avgScore = Math.round((content + delivery + preparation) / 3);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      await submitCourseScore(activityId, formData);
    });
  }

  return (
    <details className="mt-2">
      <summary
        className="text-xs cursor-pointer list-none inline-flex items-center gap-1.5"
        style={{ color: myScore ? "#3388BB" : "#E38043" }}
      >
        {myScore ? "✏️ 修改评分" : "📝 打分"}
      </summary>
      <form action={handleSubmit} className="mt-3 space-y-3 p-3 rounded-lg" style={{ background: "#F8FAFB" }}>
        <input type="hidden" name="teamId" value={teamId} />
        <input type="hidden" name="content" value={content} />
        <input type="hidden" name="delivery" value={delivery} />
        <input type="hidden" name="preparation" value={preparation} />

        <div className="space-y-3">
          <ScoreSlider label="📝 内容质量" desc="讲题深度、知识准确性、结构逻辑" value={content} onChange={setContent} disabled={isPending} />
          <ScoreSlider label="🎤 讲解表达" desc="语言流畅度、互动性、时间把控" value={delivery} onChange={setDelivery} disabled={isPending} />
          <ScoreSlider label="📋 准备充分度" desc="资料齐备、案例丰富、演示质量" value={preparation} onChange={setPreparation} disabled={isPending} />
        </div>

        {/* 快捷选分 */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] mr-1" style={{ color: "#bbb" }}>快捷：</span>
          {QUICK_SCORES.map((s) => (
            <button
              key={s}
              type="button"
              disabled={isPending}
              onClick={() => {
                setContent(s);
                setDelivery(s);
                setPreparation(s);
              }}
              className="text-[10px] px-1.5 py-0.5 rounded border transition-colors disabled:opacity-40"
              style={{
                borderColor: "#D0DEE8",
                color: content === s && delivery === s && preparation === s ? "#fff" : "#777",
                background: content === s && delivery === s && preparation === s ? "#3388BB" : "#fff",
              }}
            >
              {s}
            </button>
          ))}
        </div>

        {/* 综合分预览 */}
        <div
          className="flex items-center justify-between px-3 py-2 rounded-lg"
          style={{ background: "#E8F4FD" }}
        >
          <span className="text-xs font-medium" style={{ color: "#25547A" }}>
            综合分（平均）
          </span>
          <span
            className="text-lg font-bold"
            style={{
              color: avgScore < 35 ? "#e57373" : avgScore < 65 ? "#E38043" : "#2E7D32",
            }}
          >
            {avgScore}
            <span className="text-xs font-normal ml-1" style={{ color: "#999" }}>/ 100</span>
          </span>
        </div>

        {/* 评语 */}
        <div>
          <label className="block text-xs mb-1" style={{ color: "#777" }}>评语（可选）</label>
          <textarea
            name="comment"
            rows={2}
            defaultValue={myScore?.comment || ""}
            disabled={isPending}
            className="w-full rounded-lg border px-3 py-1.5 text-sm resize-y disabled:opacity-50"
            style={{ borderColor: "#D0DEE8" }}
            placeholder="可以写下对讲题的评价、建议…"
          />
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="text-xs px-4 py-1.5 rounded-lg text-white disabled:opacity-50 transition-colors"
          style={{ background: "#3388BB" }}
        >
          {isPending ? "提交中…" : myScore ? "更新评分" : "提交评分"}
        </button>
      </form>
    </details>
  );
}
