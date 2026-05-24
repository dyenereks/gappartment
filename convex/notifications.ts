// Node-runtime action: sends Web Push notifications via VAPID.
// `"use node"` is required — `web-push` depends on Node crypto APIs.
"use node";

import { v } from "convex/values";
import webpush from "web-push";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";

/**
 * Sends a notification payload to every push subscription owned by any of
 * the given user IDs. Silent no-op when VAPID env vars are missing (so the
 * app still works locally before push is configured). On 404/410 from the
 * push service we tombstone the stale subscription.
 */
export const sendToUsers = action({
  args: {
    userIds: v.array(v.id("users")),
    title: v.string(),
    body: v.string(),
    url: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const pub = process.env.VAPID_PUBLIC_KEY;
    const priv = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT;
    if (!pub || !priv || !subject) {
      // Not configured yet — skip silently. Dev can run without VAPID.
      return { skipped: true };
    }
    webpush.setVapidDetails(subject, pub, priv);

    const subs = await ctx.runQuery(
      internal.pushSubscriptions.forUsers,
      { userIds: args.userIds }
    );
    if (subs.length === 0) return { sent: 0 };

    const payload = JSON.stringify({
      title: args.title,
      body: args.body,
      url: args.url ?? "/",
    });

    let sent = 0;
    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: s.endpoint,
              keys: { p256dh: s.p256dh, auth: s.auth },
            },
            payload
          );
          sent++;
        } catch (err) {
          const status =
            (err as { statusCode?: number })?.statusCode;
          if (status === 404 || status === 410) {
            // Subscription is gone for good — drop it
            await ctx.runMutation(
              internal.pushSubscriptions.deleteByEndpoint,
              { endpoint: s.endpoint }
            );
          } else {
            console.error("push failed", status, err);
          }
        }
      })
    );

    return { sent };
  },
});
