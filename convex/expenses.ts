import { v } from "convex/values";
import { Doc } from "./_generated/dataModel";
import { mutation, query, QueryCtx } from "./_generated/server";
import { api } from "./_generated/api";
import { getCurrentUser, requireAdmin, requireCurrentUser } from "./_lib";

const fmtPeso = (n: number) =>
  "₱" +
  n.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

async function expandExpense(ctx: QueryCtx, expense: Doc<"expenses">) {
  const [addedBy, shares, addedByPaymentMethods] = await Promise.all([
    ctx.db.get(expense.addedById),
    ctx.db
      .query("expenseShares")
      .withIndex("by_expense", (q) => q.eq("expenseId", expense._id))
      .collect(),
    ctx.db
      .query("paymentMethods")
      .withIndex("by_user", (q) => q.eq("userId", expense.addedById))
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
    ...expense,
    addedBy: addedBy
      ? { ...addedBy, paymentMethods: addedByPaymentMethods }
      : null,
    shares: expandedShares,
  };
}

export const listByMonth = query({
  args: { month: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const me = await getCurrentUser(ctx);
    if (!me) return [];
    const expenses = args.month
      ? await ctx.db
          .query("expenses")
          .withIndex("by_month", (q) => q.eq("month", args.month!))
          .collect()
      : await ctx.db.query("expenses").collect();

    expenses.sort((a, b) => b._creationTime - a._creationTime);
    return await Promise.all(expenses.map((e) => expandExpense(ctx, e)));
  },
});

const shareInput = v.object({
  userId: v.id("users"),
  amount: v.number(),
  isPaid: v.optional(v.boolean()),
});

export const create = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.union(v.string(), v.null())),
    amount: v.number(),
    month: v.string(),
    shares: v.array(shareInput),
  },
  handler: async (ctx, args) => {
    const me = await requireCurrentUser(ctx);

    const expenseId = await ctx.db.insert("expenses", {
      title: args.title,
      description: args.description ?? null,
      amount: args.amount,
      month: args.month,
      addedById: me._id,
    });

    const now = Date.now();
    await Promise.all(
      args.shares.map((s) =>
        ctx.db.insert("expenseShares", {
          expenseId,
          userId: s.userId,
          amount: s.amount,
          isPaid: !!s.isPaid,
          paidAt: s.isPaid ? now : null,
          proofUrl: null,
          confirmedAt: s.isPaid ? now : null,
          confirmedById: s.isPaid ? me._id : null,
        })
      )
    );

    // Notify other tenants who got dragged into the split.
    const recipients = args.shares
      .map((s) => s.userId)
      .filter((uid) => uid !== me._id);
    if (recipients.length > 0) {
      await ctx.scheduler.runAfter(0, api.notifications.sendToUsers, {
        userIds: recipients,
        title: "New shared expense",
        body: `${args.title} — ${fmtPeso(args.amount)}`,
        url: "/expenses",
      });
    }

    return expenseId;
  },
});

export const update = mutation({
  args: {
    expenseId: v.id("expenses"),
    title: v.string(),
    description: v.optional(v.union(v.string(), v.null())),
    amount: v.number(),
    month: v.string(),
    markMyShareAsPaid: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);

    const expense = await ctx.db.get(args.expenseId);
    if (!expense) throw new Error("Expense not found");

    await ctx.db.patch(args.expenseId, {
      title: args.title,
      description: args.description ?? null,
      amount: args.amount,
      month: args.month,
    });

    const shares = await ctx.db
      .query("expenseShares")
      .withIndex("by_expense", (q) => q.eq("expenseId", args.expenseId))
      .collect();

    // Recalculate equally
    const shareAmount = shares.length > 0 ? args.amount / shares.length : 0;
    for (const s of shares) {
      await ctx.db.patch(s._id, { amount: shareAmount });
    }

    // Optionally toggle admin's own share paid state
    if (args.markMyShareAsPaid !== undefined) {
      const myShare = shares.find((s) => s.userId === admin._id);
      if (myShare) {
        const currentlyPaid = myShare.isPaid;
        if (args.markMyShareAsPaid && !currentlyPaid) {
          await ctx.db.patch(myShare._id, {
            isPaid: true,
            paidAt: Date.now(),
            confirmedAt: Date.now(),
            confirmedById: admin._id,
          });
        } else if (!args.markMyShareAsPaid && currentlyPaid) {
          await ctx.db.patch(myShare._id, {
            isPaid: false,
            paidAt: null,
            confirmedAt: null,
            confirmedById: null,
          });
        }
      }
    }
  },
});
