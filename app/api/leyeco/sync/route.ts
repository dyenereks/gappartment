import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// Reads the Clerk session + hits an external API — never static.
export const dynamic = "force-dynamic";

interface LeyecoApiBill {
  billMonthCode: string;
  billNumber: string;
  billDate: string;
  dueDate: string;
  kwhUsed: number;
  amount: number;
  status: string;
  // Service period the bill covers — scopes the AC energy split window.
  serviceDateFrom?: string;
  serviceDateTo?: string;
}

// Parse an ISO/date string to epoch ms, or null if absent/invalid.
function parseDate(s?: string): number | null {
  if (!s) return null;
  const t = new Date(s).getTime();
  return Number.isNaN(t) ? null : t;
}

export async function GET(request: Request) {
  // Two authorized callers:
  //  1. Cron / GitHub Action — sends `Authorization: Bearer <LEYECO_SYNC_SECRET>`.
  //  2. A signed-in admin clicking "Sync now" in the app — same-origin request
  //     carrying their Clerk session cookie (no bearer header).
  const secret = process.env.LEYECO_SYNC_SECRET;
  const authHeader = request.headers.get("Authorization");
  const viaSecret = !!secret && authHeader === `Bearer ${secret}`;

  if (!viaSecret) {
    const { userId, getToken } = await auth();
    if (!userId) {
      return new Response("Unauthorized", { status: 401 });
    }
    // Verify the caller is an admin via Convex (uses their Clerk JWT). A
    // dedicated client so we don't leave auth set on the shared instance.
    const token = await getToken({ template: "convex" });
    const authedConvex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
    if (token) authedConvex.setAuth(token);
    const me = await authedConvex.query(api.users.current);
    if (!me?.isAdmin) {
      return new Response("Forbidden — admin only", { status: 403 });
    }
  }

  const accountNumber = process.env.LEYECO_ACCOUNT_NUMBER;
  if (!accountNumber) {
    return new Response("LEYECO_ACCOUNT_NUMBER not configured", { status: 500 });
  }

  const now = new Date();
  const year = now.getFullYear();
  const currentMonthCode = `${year}${String(now.getMonth() + 1).padStart(2, "0")}`;

  const alreadySaved = await convex.query(api.leyecoBills.existsForMonth, { billMonthCode: currentMonthCode });
  if (alreadySaved) {
    return Response.json({ ok: true, message: "Bill for current month already saved", currentMonthCode });
  }

  let data: { current?: LeyecoApiBill[] };
  try {
    const res = await fetch(
      `https://www.leyeco2.online/api/anonymous/inquire-bills?accountNumber=${encodeURIComponent(accountNumber)}&year=${year}`,
      { cache: "no-store" }
    );
    if (!res.ok) {
      return new Response(`Leyeco2 API error: ${res.status}`, { status: 502 });
    }
    data = await res.json();
  } catch (err) {
    return new Response(`Failed to reach Leyeco2: ${String(err)}`, { status: 502 });
  }

  const bills = data.current ?? [];
  const currentBill = bills.find((b) => b.billMonthCode === currentMonthCode);

  if (!currentBill) {
    return Response.json({ ok: true, message: "No bill for current month yet", currentMonthCode });
  }

  const month = `${currentBill.billMonthCode.slice(0, 4)}-${currentBill.billMonthCode.slice(4, 6)}`;

  const result = await convex.mutation(api.leyecoBills.syncBill, {
    billMonthCode: currentBill.billMonthCode,
    month,
    year: parseInt(currentBill.billMonthCode.slice(0, 4)),
    amount: currentBill.amount,
    billDate: new Date(currentBill.billDate).getTime(),
    dueDate: new Date(currentBill.dueDate).getTime(),
    kwhUsed: currentBill.kwhUsed,
    status: currentBill.status,
    billNumber: currentBill.billNumber,
    serviceDateFrom: parseDate(currentBill.serviceDateFrom),
    serviceDateTo: parseDate(currentBill.serviceDateTo),
  });

  return Response.json({ ok: true, ...result });
}
