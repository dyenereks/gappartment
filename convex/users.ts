import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getCurrentUser, requireCurrentUser } from "./_lib";

// Returns the currently authenticated user's row, or null if not signed in /
// not yet synced.
export const current = query({
  args: {},
  handler: async (ctx) => {
    return await getCurrentUser(ctx);
  },
});

// Lists all users (any signed-in user can see this — needed for tenant pickers).
// Each user is denormalized with their paymentMethods so the admin page can
// surface "no payment method" warnings without an extra query per user.
//
// Fail-soft: returns [] when the caller isn't authenticated yet. The UI
// already treats an empty list as "nothing to render" and the loading state
// is signalled by `useQuery` returning undefined.
export const list = query({
  args: {},
  handler: async (ctx) => {
    const me = await getCurrentUser(ctx);
    if (!me) return [];
    const users = await ctx.db.query("users").collect();
    users.sort((a, b) => a._creationTime - b._creationTime);
    return await Promise.all(
      users.map(async (u) => {
        const paymentMethods = await ctx.db
          .query("paymentMethods")
          .withIndex("by_user", (q) => q.eq("userId", u._id))
          .collect();
        return { ...u, paymentMethods };
      })
    );
  },
});

// Upserts the current Clerk user into Convex. First user becomes admin.
export const sync = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    imageUrl: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (existing) {
      // Refresh metadata pulled from Clerk on each sync (name, email, image).
      await ctx.db.patch(existing._id, {
        name: args.name,
        email: args.email,
        imageUrl: args.imageUrl ?? null,
      });
      return existing._id;
    }

    const userCount = (await ctx.db.query("users").collect()).length;
    return await ctx.db.insert("users", {
      clerkId: identity.subject,
      name: args.name,
      email: args.email,
      imageUrl: args.imageUrl ?? null,
      isAdmin: userCount === 0, // first registered user becomes admin
      nickname: null,
    });
  },
});

// Updates the current user's editable profile fields.
export const updateProfile = mutation({
  args: {
    nickname: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const me = await requireCurrentUser(ctx);
    const patch: Record<string, unknown> = {};
    if (args.nickname !== undefined) {
      patch.nickname = args.nickname?.trim() ? args.nickname.trim() : null;
    }
    await ctx.db.patch(me._id, patch);
    return await ctx.db.get(me._id);
  },
});

// Called from the Clerk webhook (server-side, via ConvexHttpClient).
// Auth is enforced by the webhook's signature check; here we trust the caller.
export const syncFromWebhook = mutation({
  args: {
    clerkId: v.string(),
    name: v.string(),
    email: v.string(),
    imageUrl: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        name: args.name,
        email: args.email,
        imageUrl: args.imageUrl ?? null,
      });
      return existing._id;
    }

    const userCount = (await ctx.db.query("users").collect()).length;
    return await ctx.db.insert("users", {
      clerkId: args.clerkId,
      name: args.name,
      email: args.email,
      imageUrl: args.imageUrl ?? null,
      isAdmin: userCount === 0,
      nickname: null,
    });
  },
});

export const deleteByClerkId = mutation({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .unique();
    if (user) await ctx.db.delete(user._id);
  },
});
