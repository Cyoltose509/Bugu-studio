import { notFound } from "next/navigation";
import { getMockSnapshot } from "@/lib/mock/frontend-data";
import CoursePreview from "./CoursePreview";

export const dynamic = "force-dynamic";
export const metadata = { title: "公开课讲师预览", robots: { index: false, follow: false } };

export default function CoursePreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  const member = getMockSnapshot().members?.[0];
  return <CoursePreview member={member ? {
    id: member.id,
    displayName: member.displayName,
    avatar: member.avatar || null,
  } : null} />;
}
