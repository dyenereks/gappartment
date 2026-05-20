"use client";
import { useState } from "react";
import Image from "next/image";
import Modal from "./Modal";
import { formatCurrency } from "@/lib/utils";
import { CheckCircle, XCircle } from "lucide-react";

interface ConfirmPaymentModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  shareId: string;
  shareType: "bill" | "expense";
  parentId: string;
  amount: number;
  payerName: string;
  proofUrl: string;
}

export default function ConfirmPaymentModal({
  open,
  onClose,
  onSuccess,
  shareId,
  shareType,
  parentId,
  amount,
  payerName,
  proofUrl,
}: ConfirmPaymentModalProps) {
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState<"confirm" | "reject" | null>(null);
  const [error, setError] = useState("");

  const handleAction = async (act: "confirm_payment" | "reject_payment") => {
    setLoading(true);
    setAction(act === "confirm_payment" ? "confirm" : "reject");
    setError("");

    try {
      const endpoint =
        shareType === "bill"
          ? `/api/bills/${parentId}/shares/${shareId}`
          : `/api/expenses/${parentId}/shares/${shareId}`;

      const res = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: act }),
      });

      if (!res.ok) throw new Error(await res.text());
      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
      setAction(null);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Confirm Payment" size="md">
      <div className="p-5 space-y-5">
        <div className="bg-cream-100 rounded-xl p-4">
          <div className="flex justify-between items-center">
            <div>
              <div className="text-sm text-charcoal-300">From</div>
              <div className="font-semibold text-charcoal-500">{payerName}</div>
            </div>
            <div className="text-right">
              <div className="text-sm text-charcoal-300">Amount</div>
              <div className="text-xl font-bold text-brown-600">{formatCurrency(amount)}</div>
            </div>
          </div>
        </div>

        <div>
          <p className="text-sm font-medium text-charcoal-400 mb-2">Proof of Payment</p>
          <div className="rounded-xl overflow-hidden border border-cream-400">
            <Image
              src={proofUrl}
              alt="Proof of payment"
              width={400}
              height={300}
              className="w-full object-contain max-h-64 bg-cream-50"
            />
          </div>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl border border-red-200">
            {error}
          </div>
        )}

        <p className="text-sm text-charcoal-300 text-center">
          Did you receive this payment from {payerName}?
        </p>

        <div className="flex gap-3">
          <button
            onClick={() => handleAction("reject_payment")}
            disabled={loading}
            className="flex-1 py-3 rounded-xl border-2 border-red-300 text-red-500 text-sm font-medium hover:bg-red-50 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading && action === "reject" ? (
              "Processing..."
            ) : (
              <>
                <XCircle size={16} />
                Reject
              </>
            )}
          </button>
          <button
            onClick={() => handleAction("confirm_payment")}
            disabled={loading}
            className="flex-1 py-3 rounded-xl bg-green-600 text-white text-sm font-medium hover:bg-green-500 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading && action === "confirm" ? (
              "Processing..."
            ) : (
              <>
                <CheckCircle size={16} />
                Confirm Received
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}
