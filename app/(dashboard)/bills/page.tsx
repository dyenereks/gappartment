"use client";
import { useEffect, useState, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import { Plus, CheckCircle, Clock, AlertCircle, Pencil } from "lucide-react";
import MonthSelector from "@/components/MonthSelector";
import AddBillModal from "@/components/AddBillModal";
import EditBillModal from "@/components/EditBillModal";
import PaymentModal from "@/components/PaymentModal";
import ConfirmPaymentModal from "@/components/ConfirmPaymentModal";
import {
  formatCurrency,
  getCurrentMonth,
  formatMonth,
  BILL_TYPE_LABELS,
  BILL_TYPE_ICONS,
  displayName,
} from "@/lib/utils";

interface User {
  id: string;
  name: string;
  nickname?: string | null;
  imageUrl?: string | null;
  qrCodeUrl?: string | null;
  isAdmin?: boolean;
}

interface BillShare {
  id: string;
  amount: number;
  isPaid: boolean;
  paidAt: string | null;
  proofUrl: string | null;
  confirmedAt: string | null;
  user: { id: string; name: string; nickname?: string | null; imageUrl?: string | null };
  confirmedBy?: { id: string; name: string; nickname?: string | null } | null;
}

interface Bill {
  id: string;
  type: string;
  amount: number;
  month: string;
  dueDate: string | null;
  description: string | null;
  addedBy: { id: string; name: string; nickname?: string | null };
  receiver: { id: string; name: string; nickname?: string | null; qrCodeUrl?: string | null };
  shares: BillShare[];
}

export default function BillsPage() {
  const { user: clerkUser } = useUser();
  const [month, setMonth] = useState(getCurrentMonth());
  const [bills, setBills] = useState<Bill[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editBill, setEditBill] = useState<Bill | null>(null);
  const [payModal, setPayModal] = useState<{
    shareId: string;
    billId: string;
    amount: number;
    receiverName: string;
    receiverQrUrl?: string | null;
  } | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    shareId: string;
    billId: string;
    amount: number;
    payerName: string;
    proofUrl: string;
  } | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, billsRes] = await Promise.all([
        fetch("/api/users"),
        fetch(`/api/bills?month=${month}`),
      ]);
      const [u, b] = await Promise.all([usersRes.json(), billsRes.json()]);
      setUsers(u);
      setBills(b);
      const me = u.find((user: User) => user.id === clerkUser?.id);
      setIsAdmin(me?.isAdmin ?? false);
    } finally {
      setLoading(false);
    }
  }, [month, clerkUser?.id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const userId = clerkUser?.id;

  const totalBills = bills.reduce((sum, b) => sum + b.amount, 0);
  const myTotalShare = bills
    .flatMap((b) => b.shares.filter((s) => s.user.id === userId))
    .reduce((sum, s) => sum + s.amount, 0);
  const myPaid = bills
    .flatMap((b) => b.shares.filter((s) => s.user.id === userId && s.isPaid))
    .reduce((sum, s) => sum + s.amount, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brown-600">Bills</h1>
          <p className="text-charcoal-300 text-sm mt-0.5">{formatMonth(month)}</p>
        </div>
        <div className="flex items-center gap-3">
          <MonthSelector value={month} onChange={setMonth} />
          {isAdmin && (
            <button
              onClick={() => setAddModalOpen(true)}
              className="flex items-center gap-2 bg-brown-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-brown-500 transition-colors shadow-sm"
            >
              <Plus size={16} />
              Add Bill
            </button>
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl p-4 border border-cream-300 text-center">
          <div className="text-lg font-bold text-charcoal-500">{formatCurrency(totalBills)}</div>
          <div className="text-xs text-charcoal-200 mt-0.5">Total Bills</div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-cream-300 text-center">
          <div className="text-lg font-bold text-charcoal-500">{formatCurrency(myTotalShare)}</div>
          <div className="text-xs text-charcoal-200 mt-0.5">My Share</div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-cream-300 text-center">
          <div className={`text-lg font-bold ${myPaid < myTotalShare ? "text-red-500" : "text-green-600"}`}>
            {formatCurrency(myTotalShare - myPaid)}
          </div>
          <div className="text-xs text-charcoal-200 mt-0.5">Outstanding</div>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-2xl p-5 animate-pulse h-40 border border-cream-300" />
          ))}
        </div>
      ) : bills.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 text-center border border-cream-300">
          <div className="text-4xl mb-3">📋</div>
          <p className="text-charcoal-400 font-medium">No bills for {formatMonth(month)}</p>
          {isAdmin ? (
            <button
              onClick={() => setAddModalOpen(true)}
              className="mt-4 bg-brown-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-brown-500 transition-colors"
            >
              Add First Bill
            </button>
          ) : (
            <p className="text-charcoal-200 text-sm mt-2">
              Wait for the admin to add bills
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {bills.map((bill) => {
            const paidCount = bill.shares.filter((s) => s.isPaid).length;
            const pendingProof = bill.shares.filter((s) => s.proofUrl && !s.isPaid).length;
            const totalShares = bill.shares.length;

            return (
              <div key={bill.id} className="bg-white rounded-2xl border border-cream-300 shadow-sm overflow-hidden">
                {/* Bill header */}
                <div className="p-5 border-b border-cream-200">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="text-3xl">{BILL_TYPE_ICONS[bill.type] ?? "📋"}</div>
                      <div>
                        <h3 className="font-semibold text-charcoal-500">
                          {BILL_TYPE_LABELS[bill.type] ?? bill.type}
                        </h3>
                        {bill.description && (
                          <p className="text-xs text-charcoal-200">{bill.description}</p>
                        )}
                        <p className="text-xs text-charcoal-300 mt-0.5">
                          Receiver: <span className="font-medium">{displayName(bill.receiver)}</span>
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2 flex-shrink-0">
                      {isAdmin && (
                        <button
                          onClick={() => setEditBill(bill)}
                          className="p-1.5 rounded-lg text-charcoal-300 hover:text-brown-600 hover:bg-cream-200 transition-colors"
                          title="Edit bill"
                        >
                          <Pencil size={14} />
                        </button>
                      )}
                      <div className="text-right">
                        <div className="text-xl font-bold text-brown-600">
                          {formatCurrency(bill.amount)}
                        </div>
                        {bill.dueDate && (
                          <div className="text-xs text-charcoal-200 mt-0.5">
                            Due {new Date(bill.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
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
                    {pendingProof > 0 && (
                      <span className="text-xs bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full font-medium">
                        {pendingProof} pending review
                      </span>
                    )}
                  </div>
                </div>

                {/* Shares list */}
                <div className="divide-y divide-cream-200">
                  {bill.shares.map((share) => {
                    const isMe = share.user.id === userId;
                    const isReceiver = bill.receiver.id === userId;
                    const canPay = isMe && !share.isPaid && !share.proofUrl && !isReceiver;
                    const proofUploaded = !share.isPaid && share.proofUrl;
                    const canConfirm = isReceiver && proofUploaded;

                    return (
                      <div
                        key={share.id}
                        className="px-5 py-3.5 flex items-center gap-3"
                      >
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
                                      billId: bill.id,
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
                                      billId: bill.id,
                                      amount: share.amount,
                                      receiverName: displayName(bill.receiver),
                                      receiverQrUrl: bill.receiver.qrCodeUrl,
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

      {/* Modals */}
      <AddBillModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onSuccess={fetchData}
        users={users}
        currentUserId={userId ?? ""}
        defaultMonth={month}
      />

      <EditBillModal
        open={!!editBill}
        onClose={() => setEditBill(null)}
        onSuccess={fetchData}
        bill={editBill}
        users={users}
      />

      {payModal && (
        <PaymentModal
          open={!!payModal}
          onClose={() => setPayModal(null)}
          onSuccess={fetchData}
          shareId={payModal.shareId}
          shareType="bill"
          parentId={payModal.billId}
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
          shareType="bill"
          parentId={confirmModal.billId}
          amount={confirmModal.amount}
          payerName={confirmModal.payerName}
          proofUrl={confirmModal.proofUrl}
        />
      )}
    </div>
  );
}
