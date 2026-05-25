import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { api } from "./_generated/api";

export const existsForMonth = query({
  args: { billMonthCode: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("leyecoBills")
      .withIndex("by_billMonthCode", (q) => q.eq("billMonthCode", args.billMonthCode))
      .unique();
    return existing !== null;
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const bills = await ctx.db.query("leyecoBills").order("desc").collect();
    return bills;
  },
});

// Called from /api/leyeco/sync. Auth is enforced by the route's secret check.
export const syncBill = mutation({
  args: {
    billMonthCode: v.string(),
    month: v.string(),
    year: v.number(),
    amount: v.number(),
    billDate: v.number(),
    dueDate: v.number(),
    kwhUsed: v.number(),
    status: v.string(),
    billNumber: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("leyecoBills")
      .withIndex("by_billMonthCode", (q) => q.eq("billMonthCode", args.billMonthCode))
      .unique();

    if (existing) return { isNew: false, billId: existing._id };

    const billId = await ctx.db.insert("leyecoBills", args);

    const admins = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("isAdmin"), true))
      .collect();

    if (admins.length > 0) {
      const amt =
        "₱" +
        args.amount.toLocaleString("en-PH", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
      await ctx.scheduler.runAfter(0, api.notifications.sendToUsers, {
        userIds: admins.map((a) => a._id),
        title: "New Leyeco Electric Bill",
        body: `${amt} · ${args.kwhUsed} kWh — ${args.month}`,
        url: "/admin",
      });
    }

    return { isNew: true, billId };
  },
});
