import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { api } from "./_generated/api";
import { requireCurrentUser } from "./_lib";

const fmtPeso = (n: number) =>
  "₱" +
  n.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export const submitProof = mutation({
  args: {
    shareId: v.id("expenseShares"),
    proofUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const me = await requireCurrentUser(ctx);
    const share = await ctx.db.get(args.shareId);
    if (!share) throw new Error("Share not found");
    if (share.userId !== me._id) throw new Error("Forbidden");
    await ctx.db.patch(args.shareId, {
      proofUrl: args.proofUrl,
      paidAt: Date.now(),
    });

    const expense = await ctx.db.get(share.expenseId);
    if (expense && expense.addedById !== me._id) {
      await ctx.scheduler.runAfter(0, api.notifications.sendToUsers, {
        userIds: [expense.addedById],
        title: "Payment received",
        body: `${me.nickname || me.name} sent proof for ${fmtPeso(share.amount)} (${expense.title})`,
        url: "/payments",
      });
    }
  },
});

// Bulk version — see billShares.submitProofMany for rationale.
export const submitProofMany = mutation({
  args: {
    shareIds: v.array(v.id("expenseShares")),
    proofUrl: v.string(),
  },
  handler: async (ctx, args) => {
    if (args.shareIds.length === 0) return;
    const me = await requireCurrentUser(ctx);
    const now = Date.now();
    let totalAmount = 0;
    const recipients = new Set<string>();
    for (const id of args.shareIds) {
      const share = await ctx.db.get(id);
      if (!share) continue;
      if (share.userId !== me._id) throw new Error("Forbidden");
      await ctx.db.patch(id, { proofUrl: args.proofUrl, paidAt: now });
      totalAmount += share.amount;
      const expense = await ctx.db.get(share.expenseId);
      if (expense && expense.addedById !== me._id) {
        recipients.add(expense.addedById);
      }
    }

    for (const uid of recipients) {
      await ctx.scheduler.runAfter(0, api.notifications.sendToUsers, {
        userIds: [uid as import("./_generated/dataModel").Id<"users">],
        title: "Payment received",
        body: `${me.nickname || me.name} sent proof totaling ${fmtPeso(totalAmount)}`,
        url: "/payments",
      });
    }
  },
});

export const confirmPayment = mutation({
  args: { shareId: v.id("expenseShares") },
  handler: async (ctx, args) => {
    const me = await requireCurrentUser(ctx);
    const share = await ctx.db.get(args.shareId);
    if (!share) throw new Error("Share not found");
    const expense = await ctx.db.get(share.expenseId);
    if (!expense) throw new Error("Expense not found");
    if (expense.addedById !== me._id)
      throw new Error("Forbidden — only the expense creator can confirm");
    await ctx.db.patch(args.shareId, {
      isPaid: true,
      confirmedAt: Date.now(),
      confirmedById: me._id,
    });
    await ctx.scheduler.runAfter(0, api.notifications.sendToUsers, {
      userIds: [share.userId],
      title: "Payment confirmed",
      body: `${me.nickname || me.name} confirmed your payment of ${fmtPeso(share.amount)} (${expense.title})`,
      url: "/payments",
    });
  },
});

export const rejectPayment = mutation({
  args: { shareId: v.id("expenseShares") },
  handler: async (ctx, args) => {
    const me = await requireCurrentUser(ctx);
    const share = await ctx.db.get(args.shareId);
    if (!share) throw new Error("Share not found");
    const expense = await ctx.db.get(share.expenseId);
    if (!expense) throw new Error("Expense not found");
    if (expense.addedById !== me._id) throw new Error("Forbidden");
    await ctx.db.patch(args.shareId, {
      proofUrl: null,
      paidAt: null,
    });
    await ctx.scheduler.runAfter(0, api.notifications.sendToUsers, {
      userIds: [share.userId],
      title: "Payment rejected",
      body: `${me.nickname || me.name} rejected your proof for ${fmtPeso(share.amount)} (${expense.title}) — please re-upload`,
      url: "/payments",
    });
  },
});
