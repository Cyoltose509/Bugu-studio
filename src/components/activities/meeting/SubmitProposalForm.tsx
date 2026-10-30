"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { submitProposal } from "@/app/admin/activities/actions";
import { useLang } from "@/lib/i18n/LangProvider";
import MentionEditor from "@/components/ui/MentionEditor";
import { ImageDropZone } from "@/components/ui/ImageDropZone";
import { ACCEPT_ATTR, uploadImage } from "@/lib/utils/clientUpload";
import { AgendaTypeTag, agendaTypeLabel } from "@/components/activities/meeting/AgendaRow";

type ProposalKind = "SHARE" | "SHOWCASE";

const initialState = { error: "", success: false, published: false };

function Spinner() {
  return (
    <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity="0.25" />
      <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

function SubmitButton({ uploading, isAdmin }: { uploading: boolean; isAdmin: boolean }) {
  const { t } = useLang();
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending || uploading}
      className="btn-primary text-xs px-3.5 py-1.5 rounded-lg inline-flex items-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed transition-opacity"
    >
      {pending ? (
        <>
          <Spinner />
          {t("form.submitting")}
        </>
      ) : (
        t(isAdmin ? "meeting.publishProposal" : "meeting.submitProposal")
      )}
    </button>
  );
}

/**
 * 议程尾部的填写卡：由 ＋ 下拉选完类型后在议程序列末尾追加。
 * 视觉与最终议程卡同构（无外框、无边框输入），提交成功后由父级收起草稿卡。
 */
export default function SubmitProposalForm({
  activityId,
  isAdmin = false,
  initialType,
  onDone,
  onCancel,
}: {
  activityId: string;
  isAdmin?: boolean;
  initialType: ProposalKind;
  onDone?: () => void;
  onCancel?: () => void;
}) {
  const { t } = useLang();
  const router = useRouter();
  const [proposalType, setProposalType] = useState<ProposalKind>(initialType);
  const [imageUrl, setImageUrl] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  async function handleImage(file: File) {
    setUploadError("");
    setUploading(true);
    try {
      const result = await uploadImage(file, { endpoint: "/api/upload/cover", type: "proposal" });
      setImageUrl(result.url);
      setImagePreview(URL.createObjectURL(file));
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : t("form.uploadFailed"));
    } finally {
      setUploading(false);
    }
  }

  const [state, formAction] = useActionState(
    async (_prev: typeof initialState, formData: FormData) => {
      try {
        const result = await submitProposal(formData);
        if (result && "error" in result) {
          return { error: result.error as string, success: false, published: false };
        }
        router.refresh();
        return { error: "", success: true, published: result.published };
      } catch {
        return { error: t("meeting.errSubmitFailed"), success: false, published: false };
      }
    },
    initialState,
  );

  // 成功后通知父级收起草稿卡（列表经 router.refresh 带出新状态）
  useEffect(() => {
    if (state.success) onDone?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="activityId" value={activityId} />
      <input type="hidden" name="proposalType" value={proposalType} />
      {imageUrl ? <input type="hidden" name="imageUrl" value={imageUrl} /> : null}

      {state.error && (
        <p className="text-xs text-red-600 dark:text-red-400">{state.error}</p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setProposalType(proposalType === "SHARE" ? "SHOWCASE" : "SHARE")}
          title={t("meetingTalks.type")}
          aria-label={t("meetingTalks.type")}
          className="shrink-0"
        >
          <AgendaTypeTag
            type={proposalType}
            label={agendaTypeLabel(proposalType, t("activityDetail.proposalShare"), t("activityDetail.proposalShowcase"))}
          />
        </button>
        <input
          name="title"
          required
          placeholder={proposalType === "SHOWCASE" ? t("meeting.topicPlaceholderShowcase") : t("meeting.topicPlaceholder")}
          aria-label={t("meeting.topicPlaceholder")}
          className="min-w-0 flex-1 rounded-lg border-0 bg-transparent px-1 py-0.5 text-sm font-medium text-brand-navy placeholder:font-normal placeholder:text-brand-text-muted focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
        />
      </div>

      <MentionEditor
        bare
        name="description"
        placeholder={t("meeting.descOptionalPlaceholder")}
        rows={2}
        className="border-t border-brand-border-subtle"
      />

      <ImageDropZone
        className={imageUrl ? "w-full max-w-xs" : "w-fit max-w-full"}
        hint={t("meeting.proposalImageDrop")}
        disabled={uploading}
        onInvalid={setUploadError}
        onFile={handleImage}
      >
        {imagePreview || imageUrl ? (
          <div className="relative h-24 overflow-hidden rounded-lg border border-brand-border-subtle bg-brand-surface">
            <img src={imagePreview || imageUrl} alt={t("meeting.proposalImageAlt")} className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => { setImageUrl(""); setImagePreview(null); }}
              className="absolute right-1.5 top-1.5 inline-flex h-7 w-7 items-center justify-center rounded-lg bg-black/65 text-lg text-white transition hover:bg-black/85"
              aria-label={t("meeting.proposalImageRemove")}
            >
              ×
            </button>
          </div>
        ) : (
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-brand-blue transition-colors hover:bg-brand-blue/5 focus-within:ring-2 focus-within:ring-brand-blue/30">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="8" cy="8" r="1.5" /><path d="m3 17 5-5 4 4 4-6 5 7" /></svg>
            <span>{uploading ? t("meeting.proposalImageUploading") : t("meeting.proposalImageChoose")}</span>
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

      {uploadError ? <p role="alert" className="text-xs text-red-600 dark:text-red-400">{uploadError}</p> : null}

      <div className="flex items-center gap-2 pt-0.5">
        <SubmitButton uploading={uploading} isAdmin={isAdmin} />
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="text-xs text-brand-text-muted transition-colors hover:text-brand-navy"
          >
            {t("common.cancel")}
          </button>
        ) : null}
      </div>
    </form>
  );
}
