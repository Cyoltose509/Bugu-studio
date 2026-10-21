import { describe, expect, it } from "vitest";
import {
  bucketOf,
  notificationTabs,
  unreadForViewer,
  visibleTypeFilter,
  splitUnreadByType,
} from "@/lib/notifications/buckets";

describe("notification buckets", () => {
  it("gives admins the review and bug tabs, and members neither", () => {
    expect(notificationTabs(true)).toEqual(["review", "activity", "bug"]);
    expect(notificationTabs(false)).toEqual([]);
  });

  it("keeps review and bug types admin-only, and leaves member notices in the feed", () => {
    expect(bucketOf("NEW_PROJECT")).toBe("review");
    expect(bucketOf("ERROR_REPORT")).toBe("bug");
    expect(bucketOf("JAM_APPLICATION")).toBe("activity");
    expect(bucketOf("PROJECT_PUBLISHED")).toBe("activity");
    expect(bucketOf("PROJECT_RESUBMIT")).toBe("activity");
    expect(bucketOf("MENTION")).toBe("activity");

    expect(visibleTypeFilter(false, "review")).toEqual({
      type: { notIn: expect.arrayContaining(["NEW_PROJECT", "ERROR_REPORT"]) },
    });
    expect(visibleTypeFilter(false, "bug")).toEqual(visibleTypeFilter(false, null));
    expect(visibleTypeFilter(true, "review")).toEqual({
      type: { in: ["NEW_PROJECT", "PROJECT_UPDATE", "ACTIVITY_PROPOSAL", "NEW_USER"] },
    });
  });

  it("drops review and bug counts from a member's badge", () => {
    const split = splitUnreadByType([
      { type: "NEW_PROJECT", _count: 2 },
      { type: "CSP_VIOLATION", _count: 1 },
      { type: "MENTION", _count: 3 },
    ]);
    expect(unreadForViewer(split, false)).toEqual({ count: 3, review: 0, activity: 3, bug: 0 });
    expect(unreadForViewer(split, true)).toEqual({ count: 6, review: 2, activity: 3, bug: 1 });
  });
});
