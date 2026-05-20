"use client";
import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import Image from "next/image";
import { Shield, Users, TrendingDown, TrendingUp } from "lucide-react";
import MonthSelector from "@/components/MonthSelector";
import { formatCurrency, getCurrentMonth, formatMonth, displayName } from "@/lib/utils";

interface User {
  id: string;
  name: string;
  nickname?: string | null;
  email: string;
  imageUrl?: string | null;
  isAdmin: boolean;
  qrCodeUrl?: string | null;
}

interface BillShare {
  id: string;
  amount: number;
  isPaid: boolean;
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

export default function AdminPage() {
  const { user: clerkUser } = useUser();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [month, setMonth] = useState(getCurrentMonth());
  const [users, setUsers] = useState<User[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
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
        const me = u.find((user: User) => user.id === clerkUser?.id);
        setIsAdmin(me?.isAdmin ?? false);
      } finally {
        setLoading(false);
      }
    };
    if (clerkUser?.id) fetchData();
  }, [month, clerkUser?.id]);

  if (isAdmin === false) {
    return (
      <div className="text-center py-20">
        <Shield size={48} className="mx-auto text-charcoal-200 mb-4" />
        <p className="text-charcoal-400 font-medium">Admin access required</p>
      </div>
    );
  }

  const getUserBalance = (userId: string) => {
    // What this user owes others
    const billsOwed = bills
      .filter((b) => b.receiver.id !== userId)
      .flatMap((b) => b.shares.filter((s) => s.user.id === userId && !s.isPaid))
      .reduce((sum, s) => sum + s.amount, 0);
    const expOwed = expenses
      .filter((e) => e.addedBy.id !== userId)
      .flatMap((e) => e.shares.filter((s) => s.user.id === userId && !s.isPaid))
      .reduce((sum, s) => sum + s.amount, 0);
    const totalOwed = billsOwed + expOwed;

    // What others owe this user
    const billsReceivable = bills
      .filter((b) => b.receiver.id === userId)
      .flatMap((b) => b.shares.filter((s) => s.user.id !== userId && !s.isPaid))
      .reduce((sum, s) => sum + s.amount, 0);
    const expReceivable = expenses
      .filter((e) => e.addedBy.id === userId)
      .flatMap((e) => e.shares.filter((s) => s.user.id !== userId && !s.isPaid))
      .reduce((sum, s) => sum + s.amount, 0);
    const totalReceivable = billsReceivable + expReceivable;

    return { totalOwed, totalReceivable, net: totalReceivable - totalOwed };
  };

  const totalBillAmount = bills.reduce((sum, b) => sum + b.amount, 0);
  const totalExpenseAmount = expenses.reduce((sum, e) => sum + e.amount, 0);
  const totalPaidBills = bills
    .flatMap((b) => b.shares.filter((s) => s.isPaid))
    .reduce((sum, s) => sum + s.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-brown-100 rounded-xl">
            <Shield size={20} className="text-brown-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-brown-600">Admin Panel</h1>
            <p className="text-charcoal-300 text-sm">{formatMonth(month)}</p>
          </div>
        </div>
        <MonthSelector value={month} onChange={setMonth} />
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-2xl p-5 animate-pulse h-24 border border-cream-300" />
          ))}
        </div>
      ) : (
        <>
          {/* Overview stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white rounded-2xl p-4 border border-cream-300 shadow-sm">
              <div className="text-xs text-charcoal-200 mb-1">Total Bills</div>
              <div className="font-bold text-charcoal-500">{formatCurrency(totalBillAmount)}</div>
            </div>
            <div className="bg-white rounded-2xl p-4 border border-cream-300 shadow-sm">
              <div className="text-xs text-charcoal-200 mb-1">Total Expenses</div>
              <div className="font-bold text-charcoal-500">{formatCurrency(totalExpenseAmount)}</div>
            </div>
            <div className="bg-white rounded-2xl p-4 border border-cream-300 shadow-sm">
              <div className="text-xs text-charcoal-200 mb-1">Bills Collected</div>
              <div className="font-bold text-green-600">{formatCurrency(totalPaidBills)}</div>
            </div>
            <div className="bg-white rounded-2xl p-4 border border-cream-300 shadow-sm">
              <div className="text-xs text-charcoal-200 mb-1">Tenants</div>
              <div className="font-bold text-charcoal-500">{users.length}</div>
            </div>
          </div>

          {/* Tenant balances */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Users size={18} className="text-charcoal-300" />
              <h2 className="font-semibold text-charcoal-500">Tenant Balance Overview</h2>
            </div>
            <div className="space-y-3">
              {users.map((u) => {
                const { totalOwed, totalReceivable, net } = getUserBalance(u.id);
                return (
                  <div
                    key={u.id}
                    className="bg-white rounded-2xl p-4 border border-cream-300 shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      {u.imageUrl ? (
                        <Image
                          src={u.imageUrl}
                          alt={u.name}
                          width={40}
                          height={40}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-brown-400 flex items-center justify-center text-white font-bold">
                          {displayName(u).charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-charcoal-500 text-sm">{displayName(u)}</span>
                          {u.isAdmin && (
                            <span className="text-[10px] bg-brown-100 text-brown-600 px-2 py-0.5 rounded-full font-medium">
                              Admin
                            </span>
                          )}
                          {!u.qrCodeUrl && (
                            <span className="text-[10px] bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full border border-amber-200">
                              No QR
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-charcoal-200">{u.email}</div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div
                          className={`font-bold text-sm ${
                            net > 0 ? "text-green-600" : net < 0 ? "text-red-500" : "text-charcoal-300"
                          }`}
                        >
                          {net > 0 ? "+" : ""}{formatCurrency(net)}
                        </div>
                        <div className="text-xs text-charcoal-200 mt-0.5">net</div>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <div className="flex items-center gap-1.5 text-xs text-charcoal-300">
                        <TrendingDown size={12} className="text-red-400" />
                        <span>Owes {formatCurrency(totalOwed)}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-charcoal-300">
                        <TrendingUp size={12} className="text-green-500" />
                        <span>Owed {formatCurrency(totalReceivable)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bills breakdown */}
          {bills.length > 0 && (
            <div>
              <h2 className="font-semibold text-charcoal-500 mb-3">Bills Breakdown</h2>
              <div className="bg-white rounded-2xl border border-cream-300 shadow-sm overflow-hidden">
                <div className="divide-y divide-cream-200">
                  {bills.map((bill) => {
                    const paidShares = bill.shares.filter((s) => s.isPaid);
                    const paidAmount = paidShares.reduce((sum, s) => sum + s.amount, 0);
                    return (
                      <div key={bill.id} className="px-5 py-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-charcoal-500">{bill.type}</span>
                          <div className="text-right">
                            <div className="text-sm font-bold text-brown-600">{formatCurrency(bill.amount)}</div>
                            <div className="text-xs text-charcoal-200">
                              {formatCurrency(paidAmount)} collected
                            </div>
                          </div>
                        </div>
                        <div className="mt-2 bg-cream-200 rounded-full h-1.5">
                          <div
                            className="bg-green-500 h-1.5 rounded-full"
                            style={{ width: `${bill.amount > 0 ? (paidAmount / bill.amount) * 100 : 0}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
