import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getCurrentUser, requireCurrentUser } from "./_lib";

// Returns the current user's payment methods, ordered by creation time.
// Fail-soft: [] when not authenticated.
export const mine = query({
  args: {},
  handler: async (ctx) => {
    const me = await getCurrentUser(ctx);
    if (!me) return [];
    const methods = await ctx.db
      .query("paymentMethods")
      .withIndex("by_user", (q) => q.eq("userId", me._id))
      .collect();
    return methods.sort((a, b) => a._creationTime - b._creationTime);
  },
});

const normalize = (s?: string | null) => {
  if (s === undefined || s === null) return null;
  const trimmed = s.trim();
  return trimmed.length === 0 ? null : trimmed;
};

export const add = mutation({
  args: {
    provider: v.string(),
    accountNumber: v.optional(v.union(v.string(), v.null())),
    qrCodeUrl: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const me = await requireCurrentUser(ctx);

    const provider = normalize(args.provider);
    if (!provider) throw new Error("Bank / e-wallet name is required");

    const accountNumber = normalize(args.accountNumber);
    const qrCodeUrl = normalize(args.qrCodeUrl);
    if (!accountNumber && !qrCodeUrl) {
      throw new Error("Provide an account number, a QR code, or both");
    }

    return await ctx.db.insert("paymentMethods", {
      userId: me._id,
      provider,
      accountNumber,
      qrCodeUrl,
    });
  },
});

export const update = mutation({
  args: {
    methodId: v.id("paymentMethods"),
    provider: v.string(),
    accountNumber: v.optional(v.union(v.string(), v.null())),
    qrCodeUrl: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const me = await requireCurrentUser(ctx);
    const existing = await ctx.db.get(args.methodId);
    if (!existing) throw new Error("Payment method not found");
    if (existing.userId !== me._id) throw new Error("Forbidden");

    const provider = normalize(args.provider);
    if (!provider) throw new Error("Bank / e-wallet name is required");

    const accountNumber = normalize(args.accountNumber);
    const qrCodeUrl = normalize(args.qrCodeUrl);
    if (!accountNumber && !qrCodeUrl) {
      throw new Error("Provide an account number, a QR code, or both");
    }

    await ctx.db.patch(args.methodId, {
      provider,
      accountNumber,
      qrCodeUrl,
    });
  },
});

export const remove = mutation({
  args: { methodId: v.id("paymentMethods") },
  handler: async (ctx, args) => {
    const me = await requireCurrentUser(ctx);
    const existing = await ctx.db.get(args.methodId);
    if (!existing) return;
    if (existing.userId !== me._id) throw new Error("Forbidden");
    await ctx.db.delete(args.methodId);
  },
});
