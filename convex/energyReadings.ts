import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getCurrentUser } from "./_lib";

// Validator for a single mapped device reading. The route normalises the
// device's snake_case + ISO-string payload into this camelCase + epoch-ms
// shape before calling `ingest`, so the schema stays clean.
const deviceReading = v.object({
  deviceId: v.string(),
  deviceName: v.string(),
  online: v.boolean(),
  switch1: v.union(v.boolean(), v.null()),
  switch2: v.union(v.boolean(), v.null()),
  powerW: v.union(v.number(), v.null()),
  voltageV: v.union(v.number(), v.null()),
  currentA: v.union(v.number(), v.null()),
  energyKwh: v.union(v.number(), v.null()),
  deviceTimestamp: v.number(),
});

/**
 * Stores a batch of device readings — one row per device. Called from
 * /api/energy/ingest, which authorises the request with a bearer secret, so
 * there is no per-user auth here (the caller is a trusted local device).
 */
export const ingest = mutation({
  args: {
    reportedAt: v.number(),
    ratePerKwh: v.number(),
    devices: v.array(deviceReading),
  },
  handler: async (ctx, args) => {
    const ids = await Promise.all(
      args.devices.map((d) =>
        ctx.db.insert("energyReadings", {
          ...d,
          ratePerKwh: args.ratePerKwh,
          reportedAt: args.reportedAt,
        })
      )
    );
    return { inserted: ids.length };
  },
});

/**
 * Most recent reading for each known device, newest first. Handy for an admin
 * "live" view. Signed-in users only.
 */
export const latestPerDevice = query({
  args: {},
  handler: async (ctx) => {
    // Fail-soft (like users.list) so the query doesn't throw during the brief
    // window before the Clerk user is mirrored into Convex.
    const me = await getCurrentUser(ctx);
    if (!me) return [];
    // Pull a recent window and reduce to the newest row per device. The table
    // is small (a few plugs reporting periodically), so scanning the tail is
    // cheap and avoids a per-device index round-trip.
    const recent = await ctx.db
      .query("energyReadings")
      .withIndex("by_reportedAt")
      .order("desc")
      .take(500);

    const seen = new Map<string, (typeof recent)[number]>();
    for (const r of recent) {
      if (!seen.has(r.deviceId)) seen.set(r.deviceId, r);
    }
    return Array.from(seen.values());
  },
});

/**
 * Daily AC energy consumption over the last `days` (default 14, max 90).
 *
 * `energyKwh` is a cumulative meter counter, so per-interval consumption is the
 * delta between consecutive hourly readings of a device. Deltas are summed per
 * device and bucketed by Philippine calendar day (UTC+8). Returns a continuous
 * series (zero-filled for days with no readings) plus the period total and the
 * most recent rate, so the admin chart can render and estimate cost.
 */
export const dailyAcEnergy = query({
  args: { days: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const me = await getCurrentUser(ctx);
    if (!me) return { points: [], totalKwh: 0, ratePerKwh: 0 };

    const days = Math.min(Math.max(Math.round(args.days ?? 14), 1), 90);
    const now = Date.now();
    const from = now - days * 86400000;

    const readings = await ctx.db
      .query("energyReadings")
      .withIndex("by_reportedAt", (q) => q.gte("reportedAt", from))
      .collect();

    const PH_OFFSET = 8 * 3600 * 1000;
    const phDay = (ms: number) =>
      new Date(ms + PH_OFFSET).toISOString().slice(0, 10);

    // Group by device + track the most recent rate seen.
    const byDevice = new Map<string, typeof readings>();
    let ratePerKwh = 0;
    let rateAt = 0;
    for (const r of readings) {
      const arr = byDevice.get(r.deviceId);
      if (arr) arr.push(r);
      else byDevice.set(r.deviceId, [r]);
      if (r.reportedAt >= rateAt) {
        rateAt = r.reportedAt;
        ratePerKwh = r.ratePerKwh;
      }
    }

    // Sum cumulative-counter deltas into PH-day buckets.
    const dayTotals = new Map<string, number>();
    for (const rows of byDevice.values()) {
      rows.sort((a, b) => a.reportedAt - b.reportedAt);
      for (let i = 1; i < rows.length; i++) {
        const prev = rows[i - 1];
        const cur = rows[i];
        if (prev.energyKwh == null || cur.energyKwh == null) continue;
        let delta = cur.energyKwh - prev.energyKwh;
        if (delta < 0) delta = 0; // counter reset between readings — ignore the dip
        const day = phDay(cur.reportedAt);
        dayTotals.set(day, (dayTotals.get(day) ?? 0) + delta);
      }
    }

    const round = (n: number) => Math.round(n * 1000) / 1000;
    const points: { day: string; kwh: number }[] = [];
    let totalKwh = 0;
    for (let i = days - 1; i >= 0; i--) {
      const day = phDay(now - i * 86400000);
      const kwh = round(dayTotals.get(day) ?? 0);
      points.push({ day, kwh });
      totalKwh += kwh;
    }

    return { points, totalKwh: round(totalKwh), ratePerKwh };
  },
});
