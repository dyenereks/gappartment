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
    shareId: v.id("billShares"),
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

    // Notify the bill's receiver that someone just sent payment proof.
    const bill = await ctx.db.get(share.billId);
    if (bill && bill.receiverId !== me._id) {
      await ctx.scheduler.runAfter(0, api.notifications.sendToUsers, {
        userIds: [bill.receiverId],
        title: "Payment received",
        body: `${me.nickname || me.name} sent proof for ${fmtPeso(share.amount)}`,
        url: "/payments",
      });
    }
  },
});

// Bulk: submit one proof URL against multiple bill shares (typically when a
// payer makes a single transfer covering several outstanding bills).
export const submitProofMany = mutation({
  args: {
    shareIds: v.array(v.id("billShares")),
    proofUrl: v.string(),
  },
  handler: async (ctx, args) => {
    if (args.shareIds.length === 0) return;
    const me = await requireCurrentUser(ctx);
    const now = Date.now();
    let totalAmount = 0;
    const receivers = new Set<string>();
    for (const id of args.shareIds) {
      const share = await ctx.db.get(id);
      if (!share) continue;
      if (share.userId !== me._id) throw new Error("Forbidden");
      await ctx.db.patch(id, { proofUrl: args.proofUrl, paidAt: now });
      totalAmount += share.amount;
      const bill = await ctx.db.get(share.billId);
      if (bill && bill.receiverId !== me._id) receivers.add(bill.receiverId);
    }

    // One notification per unique receiver, lumped.
    for (const rid of receivers) {
      await ctx.scheduler.runAfter(0, api.notifications.sendToUsers, {
        userIds: [rid as import("./_generated/dataModel").Id<"users">],
        title: "Payment received",
        body: `${me.nickname || me.name} sent proof totaling ${fmtPeso(totalAmount)}`,
        url: "/payments",
      });
    }
  },
});

export const confirmPayment = mutation({
  args: { shareId: v.id("billShares") },
  handler: async (ctx, args) => {
    const me = await requireCurrentUser(ctx);
    const share = await ctx.db.get(args.shareId);
    if (!share) throw new Error("Share not found");
    const bill = await ctx.db.get(share.billId);
    if (!bill) throw new Error("Bill not found");
    if (bill.receiverId !== me._id)
      throw new Error("Forbidden — only the receiver can confirm");
    await ctx.db.patch(args.shareId, {
      isPaid: true,
      confirmedAt: Date.now(),
      confirmedById: me._id,
    });
    await ctx.scheduler.runAfter(0, api.notifications.sendToUsers, {
      userIds: [share.userId],
      title: "Payment confirmed",
      body: `${me.nickname || me.name} confirmed your payment of ${fmtPeso(share.amount)}`,
      url: "/payments",
    });
  },
});

export const rejectPayment = mutation({
  args: { shareId: v.id("billShares") },
  handler: async (ctx, args) => {
    const me = await requireCurrentUser(ctx);
    const share = await ctx.db.get(args.shareId);
    if (!share) throw new Error("Share not found");
    const bill = await ctx.db.get(share.billId);
    if (!bill) throw new Error("Bill not found");
    if (bill.receiverId !== me._id) throw new Error("Forbidden");
    await ctx.db.patch(args.shareId, {
      proofUrl: null,
      paidAt: null,
    });
    await ctx.scheduler.runAfter(0, api.notifications.sendToUsers, {
      userIds: [share.userId],
      title: "Payment rejected",
      body: `${me.nickname || me.name} rejected your proof for ${fmtPeso(share.amount)} — please re-upload`,
      url: "/payments",
    });
  },
});
