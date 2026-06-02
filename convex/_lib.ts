// Shared helpers. Files prefixed with `_` are private to Convex (not exposed).
import { api } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";
import { QueryCtx, MutationCtx } from "./_generated/server";

export async function getCurrentUser(
  ctx: QueryCtx | MutationCtx
): Promise<Doc<"users"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  return await ctx.db
    .query("users")
    .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
    .unique();
}

export async function requireCurrentUser(
  ctx: QueryCtx | MutationCtx
): Promise<Doc<"users">> {
  const user = await getCurrentUser(ctx);
  if (!user) throw new Error("Unauthorized");
  return user;
}

export async function requireAdmin(
  ctx: QueryCtx | MutationCtx
): Promise<Doc<"users">> {
  const user = await requireCurrentUser(ctx);
  if (!user.isAdmin) throw new Error("Forbidden — admin only");
  return user;
}

/**
 * Fire-and-forget notification helper. For each user it:
 *   1. Inserts a row into `notifications` (in-app inbox — visible instantly
 *      via Convex reactivity, regardless of web-push state).
 *   2. Schedules `notifications.sendToUsers` to deliver the same payload over
 *      Web Push (no-op when VAPID isn't configured or the user has no
 *      subscriptions).
 *
 * Call sites used to schedule the push action directly; centralising both
 * channels here keeps every notify-able event in sync across the two.
 */
export async function notify(
  ctx: MutationCtx,
  args: {
    userIds: Id<"users">[];
    title: string;
    body: string;
    url?: string;
  }
): Promise<void> {
  if (args.userIds.length === 0) return;

  await Promise.all(
    args.userIds.map((userId) =>
      ctx.db.insert("notifications", {
        userId,
        title: args.title,
        body: args.body,
        url: args.url ?? null,
        isRead: false,
      })
    )
  );

  await ctx.scheduler.runAfter(0, api.notifications.sendToUsers, {
    userIds: args.userIds,
    title: args.title,
    body: args.body,
    url: args.url,
  });
}
