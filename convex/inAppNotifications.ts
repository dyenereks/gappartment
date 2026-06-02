// Queries + mutations for the in-app notification inbox.
//
// The companion `notifications.ts` is a Node action that fans out Web Push.
// This file is everything that runs in the regular Convex (V8) runtime and
// touches the `notifications` table directly.

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireCurrentUser } from "./_lib";

/**
 * Latest notifications for the current user, newest first. Capped at `limit`
 * (default 30) — the inbox panel only shows recent items; older rows stay in
 * the DB but the UI doesn't paginate yet.
 */
export const list = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const me = await requireCurrentUser(ctx);
    const limit = args.limit ?? 30;
    return await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", me._id))
      .order("desc")
      .take(limit);
  },
});

/**
 * Count of unread notifications for the current user. Powers the bell badge.
 * Uses the compound index so it doesn't scan the user's full history.
 */
export const unreadCount = query({
  args: {},
  handler: async (ctx) => {
    const me = await requireCurrentUser(ctx);
    const rows = await ctx.db
      .query("notifications")
      .withIndex("by_user_and_read", (q) =>
        q.eq("userId", me._id).eq("isRead", false)
      )
      .collect();
    return rows.length;
  },
});

export const markRead = mutation({
  args: { id: v.id("notifications") },
  handler: async (ctx, args) => {
    const me = await requireCurrentUser(ctx);
    const n = await ctx.db.get(args.id);
    if (!n) return;
    if (n.userId !== me._id) throw new Error("Forbidden");
    if (!n.isRead) await ctx.db.patch(args.id, { isRead: true });
  },
});

export const markAllRead = mutation({
  args: {},
  handler: async (ctx) => {
    const me = await requireCurrentUser(ctx);
    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_user_and_read", (q) =>
        q.eq("userId", me._id).eq("isRead", false)
      )
      .collect();
    await Promise.all(unread.map((n) => ctx.db.patch(n._id, { isRead: true })));
  },
});
