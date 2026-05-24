import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { getCurrentUser, requireCurrentUser } from "./_lib";

/** Saves (or refreshes) a browser's push subscription for the current user. */
export const save = mutation({
  args: {
    endpoint: v.string(),
    p256dh: v.string(),
    auth: v.string(),
  },
  handler: async (ctx, args) => {
    const me = await requireCurrentUser(ctx);

    const existing = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_endpoint", (q) => q.eq("endpoint", args.endpoint))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        userId: me._id,
        p256dh: args.p256dh,
        auth: args.auth,
      });
      return existing._id;
    }

    return await ctx.db.insert("pushSubscriptions", {
      userId: me._id,
      endpoint: args.endpoint,
      p256dh: args.p256dh,
      auth: args.auth,
    });
  },
});

/** Removes the current browser's subscription. */
export const remove = mutation({
  args: { endpoint: v.string() },
  handler: async (ctx, args) => {
    const me = await getCurrentUser(ctx);
    if (!me) return;
    const existing = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_endpoint", (q) => q.eq("endpoint", args.endpoint))
      .unique();
    if (existing && existing.userId === me._id) {
      await ctx.db.delete(existing._id);
    }
  },
});

/**
 * Whether the *given* endpoint already has a subscription saved for this
 * user. Used by the client to compute UI state without exposing other
 * users' subscriptions.
 */
export const isSubscribed = query({
  args: { endpoint: v.string() },
  handler: async (ctx, args) => {
    const me = await getCurrentUser(ctx);
    if (!me) return false;
    const existing = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_endpoint", (q) => q.eq("endpoint", args.endpoint))
      .unique();
    return !!existing && existing.userId === me._id;
  },
});

// ===== Internal helpers used by the Node action =====

export const forUsers = internalQuery({
  args: { userIds: v.array(v.id("users")) },
  handler: async (ctx, args) => {
    const groups = await Promise.all(
      args.userIds.map((uid) =>
        ctx.db
          .query("pushSubscriptions")
          .withIndex("by_user", (q) => q.eq("userId", uid))
          .collect()
      )
    );
    return groups.flat();
  },
});

export const deleteByEndpoint = internalMutation({
  args: { endpoint: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_endpoint", (q) => q.eq("endpoint", args.endpoint))
      .unique();
    if (existing) await ctx.db.delete(existing._id);
  },
});
