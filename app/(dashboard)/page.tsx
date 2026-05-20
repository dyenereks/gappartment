"use client";
import { useEffect, useState, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import {
  TrendingDown,
  TrendingUp,
  Receipt,
  ShoppingBag,
  AlertCircle,
  ArrowRight,
} from "lucide-react";
import MonthSelector from "@/components/MonthSelector";
import { formatCurrency, getCurrentMonth, formatMonth, BILL_TYPE_LABELS, BILL_TYPE_ICONS, displayName } from "@/lib/utils";

interface UserData {
  id: string;
  name: string;
  nickname?: string | null;
  isAdmin: boolean;
}

interface BillShare {
  id: string;
  amount: number;
  isPaid: boolean;
  proofUrl: string | null;
  user: { id: string; name: string; nickname?: string | null };
}

interface Bill {
  id: string;
  type: string;
  amount: number;
  month: string;
  receiver: { id: string; name: string; nickname?: string | null };
  shares: BillShare[];
}

interface ExpenseShare {
  id: string;
  amount: number;
  isPaid: boolean;
  proofUrl: string | null;
  user: { id: string; name: string; nickname?: string | null };
}

interface Expense {
  id: string;
  title: string;
  amount: number;
  month: string;
  addedBy: { id: string; name: string; nickname?: string | null };
  shares: ExpenseShare[];
}

export default function DashboardPage() {
  const { user: clerkUser } = useUser();
  const [month, setMonth] = useState(getCurrentMonth());
  const [bills, setBills] = useState<Bill[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);

  const currentUser = users.find((u) => u.id === clerkUser?.id);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, billsRes, expensesRes] = await Promise.all([
        fetch("/api/users"),
        fetch(`/api/bills?month=${month}`),
        fetch(`/api/expenses?month=${month}`),
      ]);
      const [u, b, e] = await Promise.all([
        usersRes.json(),
        billsRes.json(),
        expensesRes.json(),
      ]);
      setUsers(u);
      setBills(b);
      setExpenses(e);
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // --- Balance calculations ---
  const userId = clerkUser?.id;

  // What I owe (bills where I'm payer, not yet confirmed)
  const myBillShares = bills.flatMap((b) =>
    b.shares.filter((s) => s.user.id === userId && !s.isPaid && b.receiver.id !== userId)
  );
  const myExpenseShares = expenses.flatMap((e) =>
    e.shares.filter((s) => s.user.id === userId && !s.isPaid && e.addedBy.id !== userId)
  );

  const totalOwed = myBillShares.reduce((sum, s) => sum + s.amount, 0)
    + myExpenseShares.reduce((sum, s) => sum + s.amount, 0);

  // What others owe me (bills where I'm receiver, expenses I added)
  const receivableBillShares = bills
    .filter((b) => b.receiver.id === userId)
    .flatMap((b) => b.shares.filter((s) => s.user.id !== userId && !s.isPaid));
  const receivableExpenseShares = expenses
    .filter((e) => e.addedBy.id === userId)
    .flatMap((e) => e.shares.filter((s) => s.user.id !== userId && !s.isPaid));

  const totalReceivable = receivableBillShares.reduce((sum, s) => sum + s.amount, 0)
    + receivableExpenseShares.reduce((sum, s) => sum + s.amount, 0);

  // Pending confirmations (I receive, proof uploaded, not yet confirmed)
  const pendingConfirmations = [
    ...bills.filter((b) => b.receiver.id === userId).flatMap((b) =>
      b.shares.filter((s) => s.proofUrl && !s.isPaid)
    ),
    ...expenses.filter((e) => e.addedBy.id === userId).flatMap((e) =>
      e.shares.filter((s) => s.proofUrl && !s.isPaid)
    ),
  ];

  // Unpaid my shares (I need to pay)
  const myUnpaidBills = bills.filter(
    (b) => b.receiver.id !== userId && b.shares.some((s) => s.user.id === userId && !s.isPaid)
  );
  const myUnpaidExpenses = expenses.filter(
    (e) => e.addedBy.id !== userId && e.shares.some((s) => s.user.id === userId && !s.isPaid)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brown-600">
            Hi, {clerkUser?.firstName ?? "there"} 👋
          </h1>
          <p className="text-charcoal-300 text-sm mt-0.5">
            {formatMonth(month)} overview
          </p>
        </div>
        <MonthSelector value={month} onChange={setMonth} />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-2xl p-5 animate-pulse h-28" />
          ))}
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-cream-300">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 bg-red-50 rounded-lg">
                  <TrendingDown size={18} className="text-red-500" />
                </div>
                <span className="text-sm text-charcoal-300 font-medium">I Owe</span>
              </div>
              <div className="text-2xl font-bold text-charcoal-500">{formatCurrency(totalOwed)}</div>
              <div className="text-xs text-charcoal-200 mt-1">
                {myBillShares.length + myExpenseShares.length} unpaid item{myBillShares.length + myExpenseShares.length !== 1 ? "s" : ""}
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-sm border border-cream-300">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 bg-green-50 rounded-lg">
                  <TrendingUp size={18} className="text-green-500" />
                </div>
                <span className="text-sm text-charcoal-300 font-medium">Owed to Me</span>
              </div>
              <div className="text-2xl font-bold text-charcoal-500">{formatCurrency(totalReceivable)}</div>
              <div className="text-xs text-charcoal-200 mt-1">
                {receivableBillShares.length + receivableExpenseShares.length} pending
              </div>
            </div>
          </div>

          {/* Pending confirmations alert */}
          {pendingConfirmations.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
              <AlertCircle size={20} className="text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-700">
                  {pendingConfirmations.length} payment{pendingConfirmations.length !== 1 ? "s" : ""} awaiting your confirmation
                </p>
                <p className="text-xs text-amber-600 mt-0.5">
                  Go to Payments to confirm received payments
                </p>
              </div>
              <Link href="/payments" className="text-xs font-medium text-amber-700 underline flex-shrink-0">
                View
              </Link>
            </div>
          )}

          {/* Bills this month */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-charcoal-400 flex items-center gap-2">
                <Receipt size={16} />
                Bills This Month
              </h2>
              <Link href="/bills" className="text-xs text-brown-500 flex items-center gap-1 hover:text-brown-600">
                View all <ArrowRight size={12} />
              </Link>
            </div>

            {bills.length === 0 ? (
              <div className="bg-white rounded-2xl p-6 text-center border border-cream-300">
                <p className="text-charcoal-300 text-sm">No bills added for {formatMonth(month)}</p>
                {currentUser?.isAdmin && (
                  <Link href="/bills" className="mt-2 inline-block text-sm text-brown-500 underline">
                    Add bills
                  </Link>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {bills.slice(0, 3).map((bill) => {
                  const myShare = bill.shares.find((s) => s.user.id === userId);
                  return (
                    <div
                      key={bill.id}
                      className="bg-white rounded-2xl p-4 border border-cream-300 shadow-sm flex items-center gap-4"
                    >
                      <div className="text-2xl">{BILL_TYPE_ICONS[bill.type] ?? "📋"}</div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-charcoal-500 text-sm">
                          {BILL_TYPE_LABELS[bill.type] ?? bill.type}
                        </div>
                        <div className="text-xs text-charcoal-200">
                          Total: {formatCurrency(bill.amount)} • Receiver: {displayName(bill.receiver)}
                        </div>
                      </div>
                      {myShare && (
                        <div className="text-right flex-shrink-0">
                          <div className="font-semibold text-brown-600 text-sm">
                            {formatCurrency(myShare.amount)}
                          </div>
                          <div className={`text-xs font-medium mt-0.5 ${
                            myShare.isPaid
                              ? "text-green-600"
                              : myShare.proofUrl
                              ? "text-amber-500"
                              : "text-red-500"
                          }`}>
                            {myShare.isPaid ? "Paid ✓" : myShare.proofUrl ? "Pending" : "Unpaid"}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* My unpaid items */}
          {(myUnpaidBills.length > 0 || myUnpaidExpenses.length > 0) && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-semibold text-charcoal-400 flex items-center gap-2">
                  <ShoppingBag size={16} />
                  Need to Pay
                </h2>
                <Link href="/payments" className="text-xs text-brown-500 flex items-center gap-1 hover:text-brown-600">
                  Pay now <ArrowRight size={12} />
                </Link>
              </div>
              <div className="space-y-3">
                {myUnpaidBills.map((bill) => {
                  const myShare = bill.shares.find((s) => s.user.id === userId && !s.isPaid)!;
                  return (
                    <Link
                      key={bill.id}
                      href="/payments"
                      className="bg-red-50 border border-red-100 rounded-2xl p-4 flex items-center gap-3 hover:bg-red-100 transition-colors"
                    >
                      <span className="text-xl">{BILL_TYPE_ICONS[bill.type] ?? "📋"}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-charcoal-500">
                          {BILL_TYPE_LABELS[bill.type] ?? bill.type}
                        </div>
                        <div className="text-xs text-charcoal-300">to {displayName(bill.receiver)}</div>
                      </div>
                      <div className="font-semibold text-red-600 text-sm flex-shrink-0">
                        {formatCurrency(myShare.amount)}
                      </div>
                    </Link>
                  );
                })}
                {myUnpaidExpenses.map((exp) => {
                  const myShare = exp.shares.find((s) => s.user.id === userId && !s.isPaid)!;
                  return (
                    <Link
                      key={exp.id}
                      href="/payments"
                      className="bg-red-50 border border-red-100 rounded-2xl p-4 flex items-center gap-3 hover:bg-red-100 transition-colors"
                    >
                      <span className="text-xl">🛍️</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-charcoal-500">{exp.title}</div>
                        <div className="text-xs text-charcoal-300">to {displayName(exp.addedBy)}</div>
                      </div>
                      <div className="font-semibold text-red-600 text-sm flex-shrink-0">
                        {formatCurrency(myShare.amount)}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tenants overview */}
          <div>
            <h2 className="text-base font-semibold text-charcoal-400 mb-3">All Tenants</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {users.map((u) => {
                const theirBillOwed = bills
                  .filter((b) => b.receiver.id === userId)
                  .flatMap((b) => b.shares.filter((s) => s.user.id === u.id && !s.isPaid))
                  .reduce((sum, s) => sum + s.amount, 0);
                const theirExpOwed = expenses
                  .filter((e) => e.addedBy.id === userId)
                  .flatMap((e) => e.shares.filter((s) => s.user.id === u.id && !s.isPaid))
                  .reduce((sum, s) => sum + s.amount, 0);
                const netOwedToMe = theirBillOwed + theirExpOwed;

                const iOweThemBills = bills
                  .filter((b) => b.receiver.id === u.id)
                  .flatMap((b) => b.shares.filter((s) => s.user.id === userId && !s.isPaid))
                  .reduce((sum, s) => sum + s.amount, 0);
                const iOweThemExp = expenses
                  .filter((e) => e.addedBy.id === u.id)
                  .flatMap((e) => e.shares.filter((s) => s.user.id === userId && !s.isPaid))
                  .reduce((sum, s) => sum + s.amount, 0);
                const iOweThem = iOweThemBills + iOweThemExp;

                const net = netOwedToMe - iOweThem;

                return (
                  <div key={u.id} className="bg-white rounded-2xl p-4 border border-cream-300 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-brown-400 flex items-center justify-center text-white font-bold flex-shrink-0">
                        {displayName(u).charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-charcoal-500 text-sm flex items-center gap-1.5">
                          {displayName(u)}
                          {u.isAdmin && (
                            <span className="text-[10px] bg-brown-100 text-brown-500 px-1.5 py-0.5 rounded-full font-medium">
                              Admin
                            </span>
                          )}
                          {u.id === userId && (
                            <span className="text-[10px] text-charcoal-200">(you)</span>
                          )}
                        </div>
                        {u.id !== userId && (
                          <div className={`text-xs font-medium mt-0.5 ${
                            net > 0 ? "text-green-600" : net < 0 ? "text-red-500" : "text-charcoal-200"
                          }`}>
                            {net > 0
                              ? `Owes you ${formatCurrency(net)}`
                              : net < 0
                              ? `You owe ${formatCurrency(Math.abs(net))}`
                              : "All settled"}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
