import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { mutation, query, QueryCtx } from "./_generated/server";
import { api } from "./_generated/api";
import { getCurrentUser, requireAdmin } from "./_lib";

const BILL_TYPE_PRETTY: Record<string, string> = {
  RENT: "Rent",
  ELECTRIC: "Electric",
  WATER: "Water",
};
const fmtPeso = (n: number) =>
  "₱" +
  n.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

// Helper: denormalize a single bill into the shape the frontend expects.
async function expandBill(ctx: QueryCtx, bill: Doc<"bills">) {
  const [addedBy, receiver, shares, receiverPaymentMethods] = await Promise.all([
    ctx.db.get(bill.addedById),
    ctx.db.get(bill.receiverId),
    ctx.db
      .query("billShares")
      .withIndex("by_bill", (q) => q.eq("billId", bill._id))
      .collect(),
    ctx.db
      .query("paymentMethods")
      .withIndex("by_user", (q) => q.eq("userId", bill.receiverId))
      .collect(),
  ]);

  const expandedShares = await Promise.all(
    shares.map(async (s) => {
      const [user, confirmedBy] = await Promise.all([
        ctx.db.get(s.userId),
        s.confirmedById ? ctx.db.get(s.confirmedById) : null,
      ]);
      return { ...s, user, confirmedBy };
    })
  );

  return {
    ...bill,
    addedBy,
    receiver: receiver
      ? { ...receiver, paymentMethods: receiverPaymentMethods }
      : null,
    shares: expandedShares,
  };
}

export const listByMonth = query({
  args: { month: v.optional(v.string()) },
  handler: async (ctx, args) => {
    // Fail-soft on unauthenticated state — return [] so the UI just renders
    // empty instead of throwing during sign-in / sign-out transitions.
    const me = await getCurrentUser(ctx);
    if (!me) return [];
    const bills = args.month
      ? await ctx.db
          .query("bills")
          .withIndex("by_month", (q) => q.eq("month", args.month!))
          .collect()
      : await ctx.db.query("bills").collect();

    // Sort newest first
    bills.sort((a, b) => b._creationTime - a._creationTime);
    return await Promise.all(bills.map((b) => expandBill(ctx, b)));
  },
});

const shareInput = v.object({
  userId: v.id("users"),
  amount: v.number(),
  isPaid: v.optional(v.boolean()),
});

export const create = mutation({
  args: {
    type: v.string(),
    amount: v.number(),
    month: v.string(),
    dueDate: v.optional(v.union(v.number(), v.null())),
    description: v.optional(v.union(v.string(), v.null())),
    receiverId: v.id("users"),
    shares: v.array(shareInput),
    acAmount: v.optional(v.union(v.number(), v.null())),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);

    // One bill of each type per month (e.g. only one Rent for May 2026).
    const duplicate = await ctx.db
      .query("bills")
      .withIndex("by_month", (q) => q.eq("month", args.month))
      .filter((q) => q.eq(q.field("type"), args.type))
      .first();
    if (duplicate) {
      throw new Error(
        `A ${args.type} bill already exists for ${args.month}. Edit the existing one instead.`
      );
    }

    const billId = await ctx.db.insert("bills", {
      type: args.type,
      amount: args.amount,
      month: args.month,
      dueDate: args.dueDate ?? null,
      description: args.description ?? null,
      addedById: admin._id,
      receiverId: args.receiverId,
      acAmount: args.type === "ELECTRIC" ? (args.acAmount ?? null) : null,
    });

    const now = Date.now();
    await Promise.all(
      args.shares.map((s) =>
        ctx.db.insert("billShares", {
          billId,
          userId: s.userId,
          amount: s.amount,
          isPaid: !!s.isPaid,
          paidAt: s.isPaid ? now : null,
          proofUrl: null,
          confirmedAt: s.isPaid ? now : null,
          confirmedById: s.isPaid ? admin._id : null,
        })
      )
    );

    // Notify each tenant in the bill (except the admin who added it).
    const recipients = args.shares
      .map((s) => s.userId)
      .filter((uid) => uid !== admin._id);
    if (recipients.length > 0) {
      await ctx.scheduler.runAfter(0, api.notifications.sendToUsers, {
        userIds: recipients,
        title: `New ${BILL_TYPE_PRETTY[args.type] ?? args.type} bill`,
        body: `${fmtPeso(args.amount)} for ${args.month}`,
        url: "/bills",
      });
    }

    return billId;
  },
});

export const update = mutation({
  args: {
    billId: v.id("bills"),
    type: v.string(),
    amount: v.number(),
    month: v.string(),
    dueDate: v.optional(v.union(v.number(), v.null())),
    description: v.optional(v.union(v.string(), v.null())),
    receiverId: v.id("users"),
    shares: v.array(shareInput),
    acAmount: v.optional(v.union(v.number(), v.null())),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);

    const bill = await ctx.db.get(args.billId);
    if (!bill) throw new Error("Bill not found");

    // Same one-per-type-per-month constraint, skipping the row we're updating.
    if (bill.type !== args.type || bill.month !== args.month) {
      const duplicate = await ctx.db
        .query("bills")
        .withIndex("by_month", (q) => q.eq("month", args.month))
        .filter((q) => q.eq(q.field("type"), args.type))
        .first();
      if (duplicate && duplicate._id !== args.billId) {
        throw new Error(
          `A ${args.type} bill already exists for ${args.month}. Edit the existing one instead.`
        );
      }
    }

    await ctx.db.patch(args.billId, {
      type: args.type,
      amount: args.amount,
      month: args.month,
      dueDate: args.dueDate ?? null,
      description: args.description ?? null,
      receiverId: args.receiverId,
      acAmount: args.type === "ELECTRIC" ? (args.acAmount ?? null) : null,
    });

    const existing = await ctx.db
      .query("billShares")
      .withIndex("by_bill", (q) => q.eq("billId", args.billId))
      .collect();
    const existingByUserId = new Map<Id<"users">, Doc<"billShares">>(
      existing.map((s) => [s.userId, s])
    );
    const incomingUserIds = new Set(args.shares.map((s) => s.userId));

    // Delete removed
    for (const s of existing) {
      if (!incomingUserIds.has(s.userId)) {
        await ctx.db.delete(s._id);
      }
    }

    // Upsert remaining
    const now = Date.now();
    for (const s of args.shares) {
      const existingShare = existingByUserId.get(s.userId);

      let paidFields: Partial<Doc<"billShares">> = {};
      if (s.isPaid !== undefined) {
        const currentlyPaid = existingShare?.isPaid ?? false;
        if (s.isPaid && !currentlyPaid) {
          paidFields = {
            isPaid: true,
            paidAt: now,
            confirmedAt: now,
            confirmedById: admin._id,
          };
        } else if (!s.isPaid && currentlyPaid) {
          paidFields = {
            isPaid: false,
            paidAt: null,
            confirmedAt: null,
            confirmedById: null,
          };
        }
      }

      if (existingShare) {
        await ctx.db.patch(existingShare._id, {
          amount: s.amount,
          ...paidFields,
        });
      } else {
        await ctx.db.insert("billShares", {
          billId: args.billId,
          userId: s.userId,
          amount: s.amount,
          isPaid: !!s.isPaid,
          paidAt: s.isPaid ? now : null,
          proofUrl: null,
          confirmedAt: s.isPaid ? now : null,
          confirmedById: s.isPaid ? admin._id : null,
        });
      }
    }
  },
});
