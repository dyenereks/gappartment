import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// Receives a request body + writes to Convex — never static.
export const dynamic = "force-dynamic";

// Shape the local device POSTs (snake_case + ISO timestamps).
interface IncomingDevice {
  id?: string;
  name?: string;
  online?: boolean;
  switch1?: boolean;
  switch2?: boolean;
  power_w?: number;
  voltage_v?: number;
  current_a?: number;
  energy_kwh?: number;
  timestamp?: string;
}
interface IncomingReport {
  reportedAt?: string;
  ratePerKwh?: number;
  devices?: IncomingDevice[];
}

const optNum = (x: unknown): number | null =>
  typeof x === "number" && Number.isFinite(x) ? x : null;
const optBool = (x: unknown): boolean | null =>
  typeof x === "boolean" ? x : null;
const toMs = (s: unknown, fallback: number): number => {
  if (typeof s === "string") {
    const t = Date.parse(s);
    if (!Number.isNaN(t)) return t;
  }
  if (typeof s === "number" && Number.isFinite(s)) return s;
  return fallback;
};

export async function POST(request: Request) {
  // Auth: a shared bearer secret known only to the local device. The endpoint
  // refuses to run if the secret isn't configured, so it can never be left
  // accidentally open.
  const secret = process.env.ENERGY_SYNC_SECRET;
  if (!secret) {
    return new Response("ENERGY_SYNC_SECRET not configured", { status: 500 });
  }
  if (request.headers.get("Authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  let body: IncomingReport;
  try {
    body = (await request.json()) as IncomingReport;
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  if (!Array.isArray(body.devices)) {
    return Response.json(
      { ok: false, error: "`devices` must be an array" },
      { status: 400 }
    );
  }

  const reportedAt = toMs(body.reportedAt, Date.now());
  const ratePerKwh = optNum(body.ratePerKwh) ?? 0;

  // Normalise to the storage shape; drop entries without a device id.
  const devices = body.devices
    .filter((d): d is IncomingDevice => !!d && typeof d.id === "string" && d.id.length > 0)
    .map((d) => ({
      deviceId: d.id as string,
      deviceName: typeof d.name === "string" ? d.name : "Unknown device",
      online: typeof d.online === "boolean" ? d.online : false,
      switch1: optBool(d.switch1),
      switch2: optBool(d.switch2),
      powerW: optNum(d.power_w),
      voltageV: optNum(d.voltage_v),
      currentA: optNum(d.current_a),
      energyKwh: optNum(d.energy_kwh),
      deviceTimestamp: toMs(d.timestamp, reportedAt),
    }));

  if (devices.length === 0) {
    return Response.json(
      { ok: false, error: "No valid devices in payload" },
      { status: 400 }
    );
  }

  try {
    const result = await convex.mutation(api.energyReadings.ingest, {
      reportedAt,
      ratePerKwh,
      devices,
    });
    return Response.json({ ok: true, ...result });
  } catch (err) {
    return new Response(`Failed to store readings: ${String(err)}`, {
      status: 502,
    });
  }
}
