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
  projectStatus: string;
  tags: Tag[];
  initialData: InitialData;
}

export default function ProjectEditForm({ projectId, projectStatus, tags, initialData }: Props) {
  const router = useRouter();

  async function handleSubmit(data: ProjectFormData) {
    let res: Response | null = null;
    let lastErr: Error | null = null;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        res = await fetch(`/api/projects/${projectId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (res.ok || res.status >= 400) break; // 非网络错误，直接处理
      } catch (e: any) {
        lastErr = e;
        if (attempt < 2) await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
      }
    }

    if (!res) {
      return { success: false, error: `网络连接失败，已重试3次。${lastErr?.message || ""}` };
    }

    try {
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
      projectStatus={projectStatus}
      tags={tags}
      initialData={initialData}
      onSubmit={handleSubmit}
    />
  );
}
