"use client";
import { useEffect, useState, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import { CheckCircle, Clock, AlertCircle, QrCode } from "lucide-react";
import MonthSelector from "@/components/MonthSelector";
import PaymentModal from "@/components/PaymentModal";
import ConfirmPaymentModal from "@/components/ConfirmPaymentModal";
import { formatCurrency, getCurrentMonth, formatMonth, BILL_TYPE_LABELS, BILL_TYPE_ICONS, displayName } from "@/lib/utils";

interface BillShare {
  id: string;
  amount: number;
  isPaid: boolean;
  proofUrl: string | null;
  paidAt: string | null;
  confirmedAt: string | null;
  user: { id: string; name: string; nickname?: string | null };
}

interface Bill {
  id: string;
  type: string;
  amount: number;
  month: string;
  receiver: { id: string; name: string; nickname?: string | null; qrCodeUrl?: string | null };
  shares: BillShare[];
}

interface ExpenseShare {
  id: string;
  amount: number;
  isPaid: boolean;
  proofUrl: string | null;
  paidAt: string | null;
  confirmedAt: string | null;
  user: { id: string; name: string; nickname?: string | null };
}

interface Expense {
  id: string;
  title: string;
  amount: number;
  month: string;
  addedBy: { id: string; name: string; nickname?: string | null; qrCodeUrl?: string | null };
  shares: ExpenseShare[];
}

type Tab = "outgoing" | "incoming";

export default function PaymentsPage() {
  const { user: clerkUser } = useUser();
  const [month, setMonth] = useState(getCurrentMonth());
  const [bills, setBills] = useState<Bill[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("outgoing");
  const [payModal, setPayModal] = useState<{
    shareId: string;
    parentId: string;
    type: "bill" | "expense";
    amount: number;
    receiverName: string;
    receiverQrUrl?: string | null;
  } | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    shareId: string;
    parentId: string;
    type: "bill" | "expense";
    amount: number;
    payerName: string;
    proofUrl: string;
  } | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [billsRes, expensesRes] = await Promise.all([
        fetch(`/api/bills?month=${month}`),
        fetch(`/api/expenses?month=${month}`),
      ]);
      const [b, e] = await Promise.all([billsRes.json(), expensesRes.json()]);
      setBills(b);
      setExpenses(e);
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const userId = clerkUser?.id;

  // Outgoing: what I need to pay
  const outgoingBills = bills
    .filter((b) => b.receiver.id !== userId)
    .flatMap((b) =>
      b.shares
        .filter((s) => s.user.id === userId)
        .map((s) => ({ ...s, bill: b }))
    );

  const outgoingExpenses = expenses
    .filter((e) => e.addedBy.id !== userId)
    .flatMap((e) =>
      e.shares
        .filter((s) => s.user.id === userId)
        .map((s) => ({ ...s, expense: e }))
    );

  // Incoming: what others owe me
  const incomingBills = bills
    .filter((b) => b.receiver.id === userId)
    .flatMap((b) =>
      b.shares
        .filter((s) => s.user.id !== userId)
        .map((s) => ({ ...s, bill: b }))
    );

  const incomingExpenses = expenses
    .filter((e) => e.addedBy.id === userId)
    .flatMap((e) =>
      e.shares
        .filter((s) => s.user.id !== userId)
        .map((s) => ({ ...s, expense: e }))
    );

  const pendingIncoming = [...incomingBills, ...incomingExpenses].filter(
    (s) => s.proofUrl && !s.isPaid
  ).length;

  const unpaidOutgoing = [...outgoingBills, ...outgoingExpenses].filter(
    (s) => !s.isPaid
  ).length;

  const renderStatus = (s: { isPaid: boolean; proofUrl: string | null }) => {
    if (s.isPaid)
      return (
        <span className="flex items-center gap-1 text-green-600 text-xs font-medium">
          <CheckCircle size={14} /> Paid
        </span>
      );
    if (s.proofUrl)
      return (
        <span className="flex items-center gap-1 text-amber-500 text-xs font-medium">
          <Clock size={14} /> Awaiting confirmation
        </span>
      );
    return (
      <span className="flex items-center gap-1 text-red-500 text-xs font-medium">
        <AlertCircle size={14} /> Unpaid
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brown-600">Payments</h1>
          <p className="text-charcoal-300 text-sm mt-0.5">{formatMonth(month)}</p>
        </div>
        <MonthSelector value={month} onChange={setMonth} />
      </div>

      {/* Tabs */}
      <div className="flex bg-cream-200 rounded-2xl p-1 gap-1">
        <button
          onClick={() => setTab("outgoing")}
          className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all relative ${
            tab === "outgoing"
              ? "bg-white text-brown-600 shadow-sm"
              : "text-charcoal-300 hover:text-charcoal-400"
          }`}
        >
          I Need to Pay
          {unpaidOutgoing > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold">
              {unpaidOutgoing}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab("incoming")}
          className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all relative ${
            tab === "incoming"
              ? "bg-white text-brown-600 shadow-sm"
              : "text-charcoal-300 hover:text-charcoal-400"
          }`}
        >
          Owed to Me
          {pendingIncoming > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold">
              {pendingIncoming}
            </span>
          )}
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-2xl p-5 animate-pulse h-20 border border-cream-300" />
          ))}
        </div>
      ) : tab === "outgoing" ? (
        <div className="space-y-3">
          {outgoingBills.length === 0 && outgoingExpenses.length === 0 ? (
            <div className="bg-white rounded-2xl p-10 text-center border border-cream-300">
              <CheckCircle size={40} className="mx-auto text-green-400 mb-3" />
              <p className="text-charcoal-400 font-medium">All caught up!</p>
              <p className="text-charcoal-200 text-sm mt-1">No payments needed for {formatMonth(month)}</p>
            </div>
          ) : (
            <>
              {outgoingBills.map((item) => (
                <div
                  key={item.id}
                  className="bg-white rounded-2xl p-4 border border-cream-300 shadow-sm flex items-center gap-4"
                >
                  <div className="text-2xl flex-shrink-0">{BILL_TYPE_ICONS[item.bill.type] ?? "📋"}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-charcoal-500">
                      {BILL_TYPE_LABELS[item.bill.type] ?? item.bill.type}
                    </div>
                    <div className="text-xs text-charcoal-300">
                      Pay to: {displayName(item.bill.receiver)}
                    </div>
                    <div className="mt-1">{renderStatus(item)}</div>
                  </div>
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <div className="font-bold text-brown-600">{formatCurrency(item.amount)}</div>
                    {!item.isPaid && !item.proofUrl && (
                      <button
                        onClick={() =>
                          setPayModal({
                            shareId: item.id,
                            parentId: item.bill.id,
                            type: "bill",
                            amount: item.amount,
                            receiverName: displayName(item.bill.receiver),
                            receiverQrUrl: item.bill.receiver.qrCodeUrl,
                          })
                        }
                        className="flex items-center gap-1 text-xs bg-brown-600 text-white px-3 py-1.5 rounded-lg hover:bg-brown-500 transition-colors"
                      >
                        <QrCode size={12} />
                        Pay Now
                      </button>
                    )}
                    {item.proofUrl && !item.isPaid && (
                      <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-lg border border-amber-200">
                        Proof submitted
                      </span>
                    )}
                  </div>
                </div>
              ))}

              {outgoingExpenses.map((item) => (
                <div
                  key={item.id}
                  className="bg-white rounded-2xl p-4 border border-cream-300 shadow-sm flex items-center gap-4"
                >
                  <div className="text-2xl flex-shrink-0">🛍️</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-charcoal-500">{item.expense.title}</div>
                    <div className="text-xs text-charcoal-300">Pay to: {displayName(item.expense.addedBy)}</div>
                    <div className="mt-1">{renderStatus(item)}</div>
                  </div>
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <div className="font-bold text-brown-600">{formatCurrency(item.amount)}</div>
                    {!item.isPaid && !item.proofUrl && (
                      <button
                        onClick={() =>
                          setPayModal({
                            shareId: item.id,
                            parentId: item.expense.id,
                            type: "expense",
                            amount: item.amount,
                            receiverName: displayName(item.expense.addedBy),
                            receiverQrUrl: item.expense.addedBy.qrCodeUrl,
                          })
                        }
                        className="flex items-center gap-1 text-xs bg-brown-600 text-white px-3 py-1.5 rounded-lg hover:bg-brown-500 transition-colors"
                      >
                        <QrCode size={12} />
                        Pay Now
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {incomingBills.length === 0 && incomingExpenses.length === 0 ? (
            <div className="bg-white rounded-2xl p-10 text-center border border-cream-300">
              <div className="text-4xl mb-3">💸</div>
              <p className="text-charcoal-400 font-medium">Nothing owed to you</p>
              <p className="text-charcoal-200 text-sm mt-1">For {formatMonth(month)}</p>
            </div>
          ) : (
            <>
              {incomingBills.map((item) => (
                <div
                  key={item.id}
                  className="bg-white rounded-2xl p-4 border border-cream-300 shadow-sm flex items-center gap-4"
                >
                  <div className="text-2xl flex-shrink-0">{BILL_TYPE_ICONS[item.bill.type] ?? "📋"}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-charcoal-500">
                      {BILL_TYPE_LABELS[item.bill.type] ?? item.bill.type}
                    </div>
                    <div className="text-xs text-charcoal-300">From: {displayName(item.user)}</div>
                    <div className="mt-1">{renderStatus(item)}</div>
                  </div>
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <div className="font-bold text-brown-600">{formatCurrency(item.amount)}</div>
                    {item.proofUrl && !item.isPaid && (
                      <button
                        onClick={() =>
                          setConfirmModal({
                            shareId: item.id,
                            parentId: item.bill.id,
                            type: "bill",
                            amount: item.amount,
                            payerName: displayName(item.user),
                            proofUrl: item.proofUrl!,
                          })
                        }
                        className="text-xs bg-amber-500 text-white px-3 py-1.5 rounded-lg hover:bg-amber-600 transition-colors"
                      >
                        Confirm Payment
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {incomingExpenses.map((item) => (
                <div
                  key={item.id}
                  className="bg-white rounded-2xl p-4 border border-cream-300 shadow-sm flex items-center gap-4"
                >
                  <div className="text-2xl flex-shrink-0">🛍️</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-charcoal-500">{item.expense.title}</div>
                    <div className="text-xs text-charcoal-300">From: {displayName(item.user)}</div>
                    <div className="mt-1">{renderStatus(item)}</div>
                  </div>
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <div className="font-bold text-brown-600">{formatCurrency(item.amount)}</div>
                    {item.proofUrl && !item.isPaid && (
                      <button
                        onClick={() =>
                          setConfirmModal({
                            shareId: item.id,
                            parentId: item.expense.id,
                            type: "expense",
                            amount: item.amount,
                            payerName: displayName(item.user),
                            proofUrl: item.proofUrl!,
                          })
                        }
                        className="text-xs bg-amber-500 text-white px-3 py-1.5 rounded-lg hover:bg-amber-600 transition-colors"
                      >
                        Confirm Payment
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {payModal && (
        <PaymentModal
          open={!!payModal}
          onClose={() => setPayModal(null)}
          onSuccess={fetchData}
          shareId={payModal.shareId}
          shareType={payModal.type}
          parentId={payModal.parentId}
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
          shareType={confirmModal.type}
          parentId={confirmModal.parentId}
          amount={confirmModal.amount}
          payerName={confirmModal.payerName}
          proofUrl={confirmModal.proofUrl}
        />
      )}
    </div>
  );
}
