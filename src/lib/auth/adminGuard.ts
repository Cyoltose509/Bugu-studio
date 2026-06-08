import { auth } from "@/lib/auth/auth";

export async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("权限不足：仅管理员可执行此操作");
  }
  return session;
}
