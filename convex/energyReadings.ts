import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireCurrentUser } from "./_lib";

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
    await requireCurrentUser(ctx);
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
