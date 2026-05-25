import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

interface LeyecoApiBill {
  billMonthCode: string;
  billNumber: string;
  billDate: string;
  dueDate: string;
  kwhUsed: number;
  amount: number;
  status: string;
}

export async function GET(request: Request) {
  const secret = process.env.LEYECO_SYNC_SECRET;
  if (secret) {
    const auth = request.headers.get("Authorization");
    if (auth !== `Bearer ${secret}`) {
      return new Response("Unauthorized", { status: 401 });
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
  });

  return Response.json({ ok: true, ...result });
}
