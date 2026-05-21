"use client";
import { useState, useEffect } from "react";
import Modal from "./Modal";

interface ExpenseShare {
  id: string;
  isPaid: boolean;
  user: { id: string };
}

interface Expense {
  id: string;
  title: string;
  description: string | null;
  amount: number;
  month: string;
  shares: ExpenseShare[];
}

interface EditExpenseModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  expense: Expense | null;
  currentUserId: string;
}

export default function EditExpenseModal({
  open,
  onClose,
  onSuccess,
  expense,
  currentUserId,
}: EditExpenseModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [month, setMonth] = useState("");
  const [markMyShareAsPaid, setMarkMyShareAsPaid] = useState(false);
  const [myShareWasPaid, setMyShareWasPaid] = useState(false);
  const [hasMyShare, setHasMyShare] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (expense) {
      setTitle(expense.title);
      setDescription(expense.description ?? "");
      setAmount(String(expense.amount));
      setMonth(expense.month);
      setError("");

      const myShare = expense.shares.find((s) => s.user.id === currentUserId);
      const wasPaid = myShare?.isPaid ?? false;
      setHasMyShare(!!myShare);
      setMyShareWasPaid(wasPaid);
      setMarkMyShareAsPaid(wasPaid);
    }
  }, [expense, currentUserId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const totalAmount = parseFloat(amount);
    if (!totalAmount || totalAmount <= 0) {
      setError("Enter a valid amount");
      return;
    }
    if (!title.trim()) {
      setError("Enter a title");
      return;
    }

    setLoading(true);
    try {
      const payload: Record<string, unknown> = {
        title: title.trim(),
        description: description.trim() || null,
        amount: totalAmount,
        month,
      };
      // Only include the flag if it actually changed
      if (hasMyShare && markMyShareAsPaid !== myShareWasPaid) {
        payload.markMyShareAsPaid = markMyShareAsPaid;
      }
      const res = await fetch(`/api/expenses/${expense!.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update expense");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Edit Expense" size="lg">
      <form onSubmit={handleSubmit} className="p-5 space-y-5">
        <div>
          <label className="block text-sm font-medium text-charcoal-400 mb-1.5">
            What was the expense?
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Groceries, LPG refill, Cleaning supplies"
            required
            className="w-full px-3 py-2.5 border border-cream-400 rounded-xl text-sm focus:outline-none focus:border-brown-500 bg-white"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-charcoal-400 mb-1.5">
              Total Amount (₱)
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              min="0"
              step="0.01"
              required
              className="w-full px-3 py-2.5 border border-cream-400 rounded-xl text-sm focus:outline-none focus:border-brown-500 bg-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-charcoal-400 mb-1.5">Month</label>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              required
              className="w-full px-3 py-2.5 border border-cream-400 rounded-xl text-sm focus:outline-none focus:border-brown-500 bg-white"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-charcoal-400 mb-1.5">
            Notes <span className="text-charcoal-200">(optional)</span>
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Additional details..."
            className="w-full px-3 py-2.5 border border-cream-400 rounded-xl text-sm focus:outline-none focus:border-brown-500 bg-white"
          />
        </div>

        <p className="text-xs text-charcoal-200 bg-cream-100 rounded-xl px-3 py-2">
          Changing the amount will recalculate all shares equally.
        </p>

        {/* Mark my share as already paid */}
        {hasMyShare && (
          <label className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-xl cursor-pointer hover:bg-green-100 transition-colors">
            <input
              type="checkbox"
              checked={markMyShareAsPaid}
              onChange={(e) => setMarkMyShareAsPaid(e.target.checked)}
              className="w-4 h-4 accent-green-600 rounded"
            />
            <div className="flex-1">
              <div className="text-sm font-medium text-green-700">
                Mark my share as already paid
              </div>
              <div className="text-xs text-green-600">
                You don&apos;t owe yourself — keep this on if you fronted the cost.
              </div>
            </div>
          </label>
        )}

        {error && (
          <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl border border-red-200">
            {error}
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-cream-400 text-charcoal-400 text-sm font-medium hover:bg-cream-100 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 py-3 rounded-xl bg-brown-600 text-white text-sm font-medium hover:bg-brown-500 transition-colors disabled:opacity-60"
          >
            {loading ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
