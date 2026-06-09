"use client";

import { useRouter } from "next/navigation";
import ProjectForm from "@/components/ProjectForm";
import type { ProjectFormData, InitialData } from "@/components/ProjectForm";

interface Tag {
  id: string;
  name: string;
  slug: string;
}

interface Props {
  projectId: string;
  tags: Tag[];
  initialData: InitialData;
}

export default function ProjectEditForm({ projectId, tags, initialData }: Props) {
  const router = useRouter();

  async function handleSubmit(data: ProjectFormData) {
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) {
        const errMsg = json.error || "保存失败";
        const details = json.details?.fieldErrors;
        const detailStr = details
          ? Object.entries(details)
              .map(([k, v]: [string, any]) => `· ${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
              .join("\n")
          : "";
        return { success: false, error: detailStr ? `${errMsg}\n${detailStr}` : errMsg };
      }
      router.refresh();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || "保存失败" };
    }
  }

  return (
    <ProjectForm
      mode="edit"
      tags={tags}
      initialData={initialData}
      onSubmit={handleSubmit}
    />
  );
}
