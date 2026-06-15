/**
 * POST /api/admin/reset-rate-limit
 * Dev-only: 重置内存速率限制（调试用）
 * 仅在 NODE_ENV !== "production" 时可用
 */
import { NextRequest, NextResponse } from "next/server";
import { clearInMemoryRateLimits, resetInMemoryRateLimit } from "@/lib/utils/rate-limit";

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { prefix, identifier } = body;

    if (identifier && prefix) {
      resetInMemoryRateLimit(prefix, identifier);
      return NextResponse.json({ ok: true, action: "reset-one", prefix, identifier });
    }

    const cleared = clearInMemoryRateLimits(prefix || undefined);
    return NextResponse.json({ ok: true, action: "clear-prefix", cleared });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
