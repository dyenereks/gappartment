import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Mirrors a Clerk user. `clerkId` is the Clerk subject (user.id from useUser()).
  users: defineTable({
    clerkId: v.string(),
    name: v.string(),
    nickname: v.optional(v.union(v.string(), v.null())),
    email: v.string(),
    imageUrl: v.optional(v.union(v.string(), v.null())),
    isAdmin: v.boolean(),
    // Deprecated: superseded by the paymentMethods table. Kept on schema so
    // legacy docs validate; new code should not read/write this.
    qrCodeUrl: v.optional(v.union(v.string(), v.null())),
  })
    .index("by_clerkId", ["clerkId"])
    .index("by_email", ["email"]),

  paymentMethods: defineTable({
    userId: v.id("users"),
    provider: v.string(), // "GCash" | "Maya" | "BDO" | custom string
    accountNumber: v.optional(v.union(v.string(), v.null())),
    qrCodeUrl: v.optional(v.union(v.string(), v.null())),
  }).index("by_user", ["userId"]),

  // Web push: one row per browser-subscription per user. A user may have
  // several (laptop + phone + work computer). `endpoint` is unique-ish across
  // the world — we use it to dedupe and to address pushes back to the right
  // browser via VAPID.
  pushSubscriptions: defineTable({
    userId: v.id("users"),
    endpoint: v.string(),
    p256dh: v.string(),
    auth: v.string(),
  })
    .index("by_user", ["userId"])
    .index("by_endpoint", ["endpoint"]),

  bills: defineTable({
    type: v.string(), // RENT | ELECTRIC | WATER
    amount: v.number(),
    month: v.string(), // e.g. "2024-01"
    dueDate: v.optional(v.union(v.number(), v.null())), // epoch ms
    description: v.optional(v.union(v.string(), v.null())),
    addedById: v.id("users"),
    receiverId: v.id("users"),
    // ELECTRIC bills only: portion of the total attributed entirely to the
    // admin who added the bill (their AC unit, etc.). Subtracted from the
    // total before equal-splitting, then added back to the admin's share.
    acAmount: v.optional(v.union(v.number(), v.null())),
  })
    .index("by_month", ["month"])
    .index("by_receiver", ["receiverId"]),

  billShares: defineTable({
    billId: v.id("bills"),
    userId: v.id("users"),
    amount: v.number(),
    isPaid: v.boolean(),
    paidAt: v.optional(v.union(v.number(), v.null())),
    proofUrl: v.optional(v.union(v.string(), v.null())),
    confirmedAt: v.optional(v.union(v.number(), v.null())),
    confirmedById: v.optional(v.union(v.id("users"), v.null())),
  })
    .index("by_bill", ["billId"])
    .index("by_user", ["userId"])
    .index("by_bill_and_user", ["billId", "userId"]),

  leyecoBills: defineTable({
    billMonthCode: v.string(), // "202605" — dedup key
    month: v.string(),         // "2026-05"
    year: v.number(),
    amount: v.number(),
    billDate: v.number(),      // epoch ms
    dueDate: v.number(),       // epoch ms
    kwhUsed: v.number(),
    status: v.string(),        // "PAID" | "UNPAID"
    billNumber: v.string(),
  }).index("by_billMonthCode", ["billMonthCode"]),

  expenses: defineTable({
    title: v.string(),
    description: v.optional(v.union(v.string(), v.null())),
    amount: v.number(),
    month: v.string(),
    addedById: v.id("users"),
  })
    .index("by_month", ["month"])
    .index("by_addedBy", ["addedById"]),

  expenseShares: defineTable({
    expenseId: v.id("expenses"),
    userId: v.id("users"),
    amount: v.number(),
    isPaid: v.boolean(),
    paidAt: v.optional(v.union(v.number(), v.null())),
    proofUrl: v.optional(v.union(v.string(), v.null())),
    confirmedAt: v.optional(v.union(v.number(), v.null())),
    confirmedById: v.optional(v.union(v.id("users"), v.null())),
  })
    .index("by_expense", ["expenseId"])
    .index("by_user", ["userId"])
    .index("by_expense_and_user", ["expenseId", "userId"]),
});
