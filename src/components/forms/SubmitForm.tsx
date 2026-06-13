"use client";

import ProjectForm from "@/components/projects/ProjectForm";
import type { ProjectFormData } from "@/components/projects/ProjectForm";

interface Tag {
  id: string;
  name: string;
  slug: string;
}

interface Props {
  tags: Tag[];
}

export default function SubmitForm({ tags }: Props) {
  async function handleSubmit(data: ProjectFormData) {
    const res = await fetch("/api/projects/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) {
      return { success: false, error: json.error || "提交失败" };
    }
    return { success: true };
  }

  return (
    <ProjectForm
      mode="create"
      tags={tags}
      onSubmit={handleSubmit}
    />
  );
}
