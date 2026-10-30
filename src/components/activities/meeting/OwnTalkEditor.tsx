"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateMeetingTalkOwn } from "@/app/admin/activities/actions";
import { parseBvId } from "@/lib/activities/constants";
import { ImageDropZone } from "@/components/ui/ImageDropZone";
import { ACCEPT_ATTR, uploadImage } from "@/lib/utils/clientUpload";
import { useLang } from "@/lib/i18n/LangProvider";
import { AgendaTypeTag, agendaTypeLabel } from "@/components/activities/meeting/AgendaRow";

export type OwnTalkDraft = {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  talkType: "SHARE" | "SHOWCASE";
  bvId: string;
};

function PencilIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 20h9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * 上传者本人修改自己议程卡片的小编辑器。
 * 只开放内容字段（标题/简介/配图/BV/类型），主讲名单仍由管理员维护。
 * 保存失败只在面板内提示，不冒泡到路由错误边界。
 */
export default function OwnTalkEditor({ talk }: { talk: OwnTalkDraft }) {
  const { t } = useLang();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(talk.title);
  const [description, setDescription] = useState(talk.description);
  const [imageUrl, setImageUrl] = useState(talk.imageUrl);
  const [talkType, setTalkType] = useState<"SHARE" | "SHOWCASE">(talk.talkType);
  const [bvId, setBvId] = useState(talk.bvId);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const editLabel = t("meetingTalks.editMyTalk");

  async function handleImage(file: File) {
    setUploadError("");
    setUploading(true);
    try {
      const result = await uploadImage(file, { endpoint: "/api/upload/cover", type: "proposal" });
      setImageUrl(result.url);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : t("form.uploadFailed"));
    } finally {
      setUploading(false);
    }
  }

  function save() {
    setMessage(null);
    startTransition(async () => {
      let result;
      try {
        result = await updateMeetingTalkOwn(talk.id, {
          title,
          description,
          imageUrl,
          talkType,
          bvId,
        });
      } catch {
        setMessage({ type: "err", text: t("meetingTalks.errSaveFailed") });
        return;
      }
      if (result && "error" in result && result.error) {
        setMessage({ type: "err", text: result.error });
        return;
      }
      setMessage({ type: "ok", text: t("meetingTalks.saved") });
      router.refresh();
      setOpen(false);
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={editLabel}
        aria-label={editLabel}
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-brand-text-muted transition-colors hover:bg-brand-surface hover:text-brand-navy"
      >
        <PencilIcon />
      </button>
    );
  }

  const field =
    "w-full rounded-lg border px-3 py-2 text-sm border-brand-border-subtle text-brand-text-heading bg-card placeholder:text-brand-text-muted focus:outline-none focus:ring-2 focus:ring-brand-blue/40";

  return (
    <div className="mt-2 w-full space-y-2.5 rounded-xl border border-brand-blue/30 bg-brand-surface/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-brand-navy">{editLabel}</span>
        <button
          type="button"
          onClick={() => {
            // 取消时还原为进入编辑前的服务端状态
            setTitle(talk.title);
            setDescription(talk.description);
            setImageUrl(talk.imageUrl);
            setTalkType(talk.talkType);
            setBvId(talk.bvId);
            setMessage(null);
            setUploadError("");
            setOpen(false);
          }}
          className="text-xs text-brand-text-muted hover:text-brand-navy"
        >
          {t("common.cancel")}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setTalkType(talkType === "SHARE" ? "SHOWCASE" : "SHARE")}
          className="shrink-0"
          title={t("meetingTalks.type")}
          aria-label={t("meetingTalks.type")}
        >
          <AgendaTypeTag
            type={talkType}
            label={agendaTypeLabel(talkType, t("activityDetail.proposalShare"), t("activityDetail.proposalShowcase"))}
          />
        </button>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          aria-label={t("meetingTalks.topicPlaceholder")}
          placeholder={t("meetingTalks.topicPlaceholder")}
          className="min-w-0 flex-1 rounded-lg border-0 bg-transparent px-1 py-1 text-sm font-semibold text-brand-text-heading placeholder:font-normal placeholder:text-brand-text-muted focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
        />
      </div>

      <textarea
        rows={2}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder={t("meetingTalks.descriptionPlaceholder")}
        aria-label={t("meetingTalks.descriptionPlaceholder")}
        className="block w-full resize-y rounded-lg border-0 bg-card px-3 py-2 text-sm leading-6 text-brand-text-secondary placeholder:text-brand-text-muted focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
      />

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={bvId}
          onChange={(e) => setBvId(e.target.value)}
          aria-label={t("meetingTalks.bvPlaceholder")}
          placeholder={t("meetingTalks.bvPlaceholder")}
          className={`min-w-0 flex-1 ${field} ${bvId && !parseBvId(bvId) ? "border-red-400" : ""}`}
        />
      </div>

      <ImageDropZone
        className={imageUrl ? "w-full max-w-xs" : "w-fit max-w-full"}
        disabled={uploading}
        onInvalid={setUploadError}
        onFile={(file) => void handleImage(file)}
      >
        {imageUrl ? (
          <div className="group/image relative h-24 overflow-hidden rounded-lg border border-brand-border-subtle bg-brand-surface">
            <img src={imageUrl} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => setImageUrl("")}
              className="absolute right-1.5 top-1.5 inline-flex h-7 w-7 items-center justify-center rounded-lg bg-black/65 text-lg text-white transition hover:bg-black/85"
              aria-label={t("meetingTalks.removeImage")}
            >
              ×
            </button>
          </div>
        ) : (
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-brand-blue transition-colors hover:bg-brand-blue/5 focus-within:ring-2 focus-within:ring-brand-blue/30">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="8" cy="8" r="1.5" /><path d="m3 17 5-5 4 4 4-6 5 7" /></svg>
            <span>{uploading ? t("meetingTalks.uploadingImage") : t("meetingTalks.addImage")}</span>
            <input
              type="file"
              accept={ACCEPT_ATTR}
              className="sr-only"
              disabled={uploading}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void handleImage(file);
              }}
            />
          </label>
        )}
      </ImageDropZone>

      {uploadError ? <p className="text-xs text-red-600 dark:text-red-400">{uploadError}</p> : null}
      {message ? (
        <p className={`text-xs ${message.type === "ok" ? "text-green-700 dark:text-green-400" : "text-red-600"}`}>{message.text}</p>
      ) : null}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={pending || uploading || !title.trim() || (!!bvId && !parseBvId(bvId))}
          className="btn-primary px-4 py-1.5 rounded-lg text-xs font-medium disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {pending ? t("common.saving") : t("meetingTalks.save")}
        </button>
      </div>
    </div>
  );
}
