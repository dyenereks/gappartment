"use client";
import { useEffect, useState, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import { Plus, CheckCircle, Clock, AlertCircle, Pencil } from "lucide-react";
import MonthSelector from "@/components/MonthSelector";
import AddExpenseModal from "@/components/AddExpenseModal";
import EditExpenseModal from "@/components/EditExpenseModal";
import PaymentModal from "@/components/PaymentModal";
import ConfirmPaymentModal from "@/components/ConfirmPaymentModal";
import { formatCurrency, getCurrentMonth, formatMonth, displayName } from "@/lib/utils";

interface User {
  id: string;
  name: string;
  nickname?: string | null;
  imageUrl?: string | null;
  qrCodeUrl?: string | null;
  isAdmin?: boolean;
}

interface ExpenseShare {
  id: string;
  amount: number;
  isPaid: boolean;
  paidAt: string | null;
  proofUrl: string | null;
  confirmedAt: string | null;
  user: { id: string; name: string; nickname?: string | null };
  confirmedBy?: { id: string; name: string; nickname?: string | null } | null;
}

interface Expense {
  id: string;
  title: string;
  description: string | null;
  amount: number;
  month: string;
  createdAt: string;
  addedBy: { id: string; name: string; nickname?: string | null; qrCodeUrl?: string | null };
  shares: ExpenseShare[];
}

export default function ExpensesPage() {
  const { user: clerkUser } = useUser();
  const [month, setMonth] = useState(getCurrentMonth());
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editExpense, setEditExpense] = useState<Expense | null>(null);
  const [payModal, setPayModal] = useState<{
    shareId: string;
    expenseId: string;
    amount: number;
    receiverName: string;
    receiverQrUrl?: string | null;
  } | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    shareId: string;
    expenseId: string;
    amount: number;
    payerName: string;
    proofUrl: string;
  } | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, expensesRes] = await Promise.all([
        fetch("/api/users"),
        fetch(`/api/expenses?month=${month}`),
      ]);
      const [u, e] = await Promise.all([usersRes.json(), expensesRes.json()]);
      setUsers(u);
      setExpenses(e);
      const me = u.find((user: User) => user.id === clerkUser?.id);
      setIsAdmin(me?.isAdmin ?? false);
    } finally {
      setLoading(false);
    }
  }, [month, clerkUser?.id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const userId = clerkUser?.id;

  const mySpent = expenses
    .filter((e) => e.addedBy.id === userId)
    .reduce((sum, e) => sum + e.amount, 0);

  const myOwed = expenses
    .filter((e) => e.addedBy.id !== userId)
    .flatMap((e) => e.shares.filter((s) => s.user.id === userId && !s.isPaid))
    .reduce((sum, s) => sum + s.amount, 0);

  const pendingPayments = expenses.flatMap((e) =>
    e.shares.filter((s) => s.proofUrl && !s.isPaid && e.addedBy.id === userId)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brown-600">Shared Expenses</h1>
          <p className="text-charcoal-300 text-sm mt-0.5">{formatMonth(month)}</p>
        </div>
        <div className="flex items-center gap-3">
          <MonthSelector value={month} onChange={setMonth} />
          <button
            onClick={() => setAddModalOpen(true)}
            className="flex items-center gap-2 bg-brown-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-brown-500 transition-colors shadow-sm"
          >
            <Plus size={16} />
            Add Expense
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl p-4 border border-cream-300 text-center">
          <div className="text-lg font-bold text-charcoal-500">
            {formatCurrency(mySpent)}
          </div>
          <div className="text-xs text-charcoal-200 mt-0.5">I Spent</div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-cream-300 text-center">
          <div className="text-lg font-bold text-red-500">{formatCurrency(myOwed)}</div>
          <div className="text-xs text-charcoal-200 mt-0.5">I Owe</div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-cream-300 text-center">
          <div className="text-lg font-bold text-amber-500">{pendingPayments.length}</div>
          <div className="text-xs text-charcoal-200 mt-0.5">To Confirm</div>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-2xl p-5 animate-pulse h-40 border border-cream-300" />
          ))}
        </div>
      ) : expenses.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 text-center border border-cream-300">
          <div className="text-4xl mb-3">🛍️</div>
          <p className="text-charcoal-400 font-medium">No shared expenses for {formatMonth(month)}</p>
          <button
            onClick={() => setAddModalOpen(true)}
            className="mt-4 bg-brown-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-brown-500 transition-colors"
          >
            Add First Expense
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {expenses.map((expense) => {
            const iAddedIt = expense.addedBy.id === userId;
            const myShare = expense.shares.find((s) => s.user.id === userId);
            const paidCount = expense.shares.filter((s) => s.isPaid).length;
            const totalShares = expense.shares.length;

            return (
              <div key={expense.id} className="bg-white rounded-2xl border border-cream-300 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-cream-200">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="text-3xl">🛍️</div>
                      <div>
                        <h3 className="font-semibold text-charcoal-500">{expense.title}</h3>
                        {expense.description && (
                          <p className="text-xs text-charcoal-200">{expense.description}</p>
                        )}
                        <p className="text-xs text-charcoal-300 mt-0.5">
                          Added by{" "}
                          <span className="font-medium">
                            {iAddedIt ? "you" : displayName(expense.addedBy)}
                          </span>
                        </p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 flex items-start gap-2">
                      {isAdmin && (
                        <button
                          onClick={() => setEditExpense(expense)}
                          className="p-1.5 rounded-lg text-charcoal-300 hover:text-brown-600 hover:bg-cream-200 transition-colors"
                          title="Edit expense"
                        >
                          <Pencil size={14} />
                        </button>
                      )}
                      <div className="text-right">
                        <div className="text-xl font-bold text-brown-600">
                          {formatCurrency(expense.amount)}
                        </div>
                        {myShare && !iAddedIt && (
                          <div className={`text-xs font-medium mt-0.5 ${
                            myShare.isPaid ? "text-green-600" : myShare.proofUrl ? "text-amber-500" : "text-red-500"
                          }`}>
                            My share: {formatCurrency(myShare.amount)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    <div className="flex-1 bg-cream-200 rounded-full h-1.5">
                      <div
                        className="bg-green-500 h-1.5 rounded-full transition-all"
                        style={{ width: `${totalShares > 0 ? (paidCount / totalShares) * 100 : 0}%` }}
                      />
                    </div>
                    <span className="text-xs text-charcoal-300 flex-shrink-0">
                      {paidCount}/{totalShares} paid
                    </span>
                  </div>
                </div>

                <div className="divide-y divide-cream-200">
                  {expense.shares.map((share) => {
                    const isMe = share.user.id === userId;
                    const canPay = isMe && !share.isPaid && !share.proofUrl && !iAddedIt;
                    const proofUploaded = !share.isPaid && share.proofUrl;
                    const canConfirm = iAddedIt && proofUploaded;

                    return (
                      <div key={share.id} className="px-5 py-3.5 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-brown-300 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                          {displayName(share.user).charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-charcoal-500">
                            {displayName(share.user)} {isMe && <span className="text-charcoal-200">(you)</span>}
                          </div>
                          <div className="text-xs text-charcoal-200">
                            {formatCurrency(share.amount)}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          {share.isPaid ? (
                            <div className="flex items-center gap-1 text-green-600 text-xs font-medium">
                              <CheckCircle size={14} />
                              Paid
                            </div>
                          ) : proofUploaded ? (
                            <>
                              <div className="flex items-center gap-1 text-amber-500 text-xs font-medium">
                                <Clock size={14} />
                                Proof uploaded
                              </div>
                              {canConfirm && (
                                <button
                                  onClick={() =>
                                    setConfirmModal({
                                      shareId: share.id,
                                      expenseId: expense.id,
                                      amount: share.amount,
                                      payerName: displayName(share.user),
                                      proofUrl: share.proofUrl!,
                                    })
                                  }
                                  className="text-xs bg-amber-500 text-white px-2.5 py-1 rounded-lg hover:bg-amber-600 transition-colors"
                                >
                                  Review
                                </button>
                              )}
                            </>
                          ) : (
                            <>
                              <div className="flex items-center gap-1 text-red-500 text-xs font-medium">
                                <AlertCircle size={14} />
                                Unpaid
                              </div>
                              {canPay && (
                                <button
                                  onClick={() =>
                                    setPayModal({
                                      shareId: share.id,
                                      expenseId: expense.id,
                                      amount: share.amount,
                                      receiverName: displayName(expense.addedBy),
                                      receiverQrUrl: expense.addedBy.qrCodeUrl,
                                    })
                                  }
                                  className="text-xs bg-brown-600 text-white px-2.5 py-1 rounded-lg hover:bg-brown-500 transition-colors"
                                >
                                  Pay
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AddExpenseModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onSuccess={fetchData}
        users={users}
        currentUserId={userId ?? ""}
        defaultMonth={month}
      />

      <EditExpenseModal
        open={!!editExpense}
        onClose={() => setEditExpense(null)}
        onSuccess={fetchData}
        expense={editExpense}
      />

      {payModal && (
        <PaymentModal
          open={!!payModal}
          onClose={() => setPayModal(null)}
          onSuccess={fetchData}
          shareId={payModal.shareId}
          shareType="expense"
          parentId={payModal.expenseId}
          amount={payModal.amount}
          receiverName={payModal.receiverName}
          receiverQrUrl={payModal.receiverQrUrl}
        />
      )}

      {confirmModal && (
        <ConfirmPaymentModal
          open={!!confirmModal}
          onClose={() => setConfirmModal(null)}
          onSuccess={fetchData}
          shareId={confirmModal.shareId}
          shareType="expense"
          parentId={confirmModal.expenseId}
          amount={confirmModal.amount}
          payerName={confirmModal.payerName}
          proofUrl={confirmModal.proofUrl}
        />
      )}
    </div>
  );
}
