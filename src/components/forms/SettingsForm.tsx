"use client";

import { useState, useTransition } from "react";
import { updateNotificationSettings } from "@/app/profile/settings/actions";

export default function SettingsForm({
  notifyNewProjects,
}: {
  notifyNewProjects: boolean;
}) {
  const [checked, setChecked] = useState(notifyNewProjects);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  async function handleToggle(e: React.ChangeEvent<HTMLInputElement>) {
    const next = e.target.checked;
    setChecked(next);
    setSaving(true);
    setMessage("");

    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("notifyNewProjects", next ? "on" : "");
        const res = await updateNotificationSettings(fd);
        if (res.success) {
          setMessage(next ? "已开启作品上新通知" : "已关闭作品上新通知");
        }
      } catch {
        setMessage("保存失败，请重试");
        setChecked(!next);
      } finally {
        setSaving(false);
      }
    });
  }

  return (
    <div className="flex items-center gap-4">
      <label className="relative inline-flex items-center cursor-pointer">
        <input
          type="checkbox"
          checked={checked}
          onChange={handleToggle}
          disabled={saving || isPending}
          className="sr-only peer"
        />
        <div className="w-11 h-6 rounded-full transition-colors peer-focus:outline-none peer:bg-[#D0DEE8] peer-checked:bg-[#88C232] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-card after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full" />
      </label>
      <span className="text-sm text-brand-text-body">
        {checked ? "已开启" : "已关闭"}
      </span>
      {(saving || isPending) && (
        <span className="text-xs text-brand-text-muted">保存中…</span>
      )}
      {message && (
        <span className="text-xs text-brand-green">{message}</span>
      )}
    </div>
  );
}
