"use client";
import { useState, useEffect } from "react";
import Modal from "./Modal";
import { formatCurrency, getCurrentMonth, displayName } from "@/lib/utils";

interface User {
  id: string;
  name: string;
  nickname?: string | null;
}

interface AddExpenseModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  users: User[];
  currentUserId: string;
  defaultMonth?: string;
}

export default function AddExpenseModal({
  open,
  onClose,
  onSuccess,
  users,
  currentUserId,
  defaultMonth,
}: AddExpenseModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [month, setMonth] = useState(defaultMonth ?? getCurrentMonth());
  const [splitMode, setSplitMode] = useState<"equal" | "custom">("equal");
  const [selectedUsers, setSelectedUsers] = useState<string[]>(
    users.filter((u) => u.id !== currentUserId).map((u) => u.id)
  );
  const [customShares, setCustomShares] = useState<Record<string, string>>({});
  const [markMyShareAsPaid, setMarkMyShareAsPaid] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setSelectedUsers(users.filter((u) => u.id !== currentUserId).map((u) => u.id));
      setMarkMyShareAsPaid(false);
    }
  }, [open, users, currentUserId]);

  useEffect(() => {
    if (defaultMonth) setMonth(defaultMonth);
  }, [defaultMonth]);

  const participantCount = selectedUsers.length;
  const equalShare = amount && participantCount > 0
    ? parseFloat(amount) / (participantCount + 1) // includes adder
    : 0;

  const toggleUser = (userId: string) => {
    setSelectedUsers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const customTotal = Object.values(customShares).reduce(
    (sum, v) => sum + (parseFloat(v) || 0),
    0
  );

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
    if (selectedUsers.length === 0) {
      setError("Select at least one tenant to share with");
      return;
    }

    // All participants (adder + selected)
    const allParticipants = [currentUserId, ...selectedUsers];

    let shares: { userId: string; amount: number; isPaid?: boolean }[];
    if (splitMode === "equal") {
      const shareAmt = totalAmount / allParticipants.length;
      shares = allParticipants.map((uid) => ({ userId: uid, amount: shareAmt }));
    } else {
      const assignedTotal = allParticipants.reduce(
        (sum, uid) => sum + (parseFloat(customShares[uid] || "0")),
        0
      );
      const diff = Math.abs(assignedTotal - totalAmount);
      if (diff > 0.01) {
        setError(`Custom shares must equal total (${formatCurrency(totalAmount)}). Current: ${formatCurrency(assignedTotal)}`);
        return;
      }
      shares = allParticipants.map((uid) => ({
        userId: uid,
        amount: parseFloat(customShares[uid] || "0"),
      }));
    }

    // Mark adder's own share as paid if requested
    if (markMyShareAsPaid) {
      shares = shares.map((s) =>
        s.userId === currentUserId ? { ...s, isPaid: true } : s
      );
    }

    setLoading(true);
    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description: description || null, amount: totalAmount, month, shares }),
      });
      if (!res.ok) throw new Error(await res.text());
      onSuccess();
      onClose();
      resetForm();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to add expense");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setAmount("");
    setSplitMode("equal");
    setCustomShares({});
    setMarkMyShareAsPaid(false);
    setError("");
  };

  const allParticipants = [
    users.find((u) => u.id === currentUserId)!,
    ...users.filter((u) => selectedUsers.includes(u.id)),
  ].filter(Boolean);

  return (
    <Modal open={open} onClose={onClose} title="Add Shared Expense" size="lg">
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

        {/* Who shares */}
        <div>
          <label className="block text-sm font-medium text-charcoal-400 mb-2">
            Share with (you are always included)
          </label>
          <div className="space-y-2">
            {users
              .filter((u) => u.id !== currentUserId)
              .map((u) => (
                <label
                  key={u.id}
                  className="flex items-center gap-3 p-3 bg-cream-100 rounded-xl cursor-pointer hover:bg-cream-200 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={selectedUsers.includes(u.id)}
                    onChange={() => toggleUser(u.id)}
                    className="w-4 h-4 accent-brown-600 rounded"
                  />
                  <div className="w-7 h-7 rounded-full bg-brown-300 flex items-center justify-center text-white text-xs font-bold">
                    {displayName(u).charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm text-charcoal-400">{displayName(u)}</span>
                </label>
              ))}
          </div>
        </div>

        {/* Split mode */}
        {selectedUsers.length > 0 && (
          <div>
            <div className="flex gap-2 mb-3">
              <button
                type="button"
                onClick={() => setSplitMode("equal")}
                className={`flex-1 py-2 rounded-xl text-sm font-medium border-2 transition-all ${
                  splitMode === "equal"
                    ? "border-brown-600 bg-brown-600 text-white"
                    : "border-cream-400 text-charcoal-400 hover:border-brown-300"
                }`}
              >
                Equal Split
              </button>
              <button
                type="button"
                onClick={() => setSplitMode("custom")}
                className={`flex-1 py-2 rounded-xl text-sm font-medium border-2 transition-all ${
                  splitMode === "custom"
                    ? "border-brown-600 bg-brown-600 text-white"
                    : "border-cream-400 text-charcoal-400 hover:border-brown-300"
                }`}
              >
                Custom Split
              </button>
            </div>

            <div className="space-y-2 bg-cream-100 rounded-xl p-3">
              {allParticipants.map((u) => (
                <div key={u.id} className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-brown-300 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                    {displayName(u).charAt(0).toUpperCase()}
                  </div>
                  <span className="flex-1 text-sm text-charcoal-400">
                    {displayName(u)} {u.id === currentUserId && "(you)"}
                  </span>
                  {splitMode === "equal" ? (
                    <span className="text-sm font-medium text-brown-600">
                      {equalShare > 0 ? formatCurrency(equalShare) : "—"}
                    </span>
                  ) : (
                    <input
                      type="number"
                      value={customShares[u.id] ?? ""}
                      onChange={(e) =>
                        setCustomShares((prev) => ({ ...prev, [u.id]: e.target.value }))
                      }
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                      className="w-28 px-2 py-1.5 border border-cream-400 rounded-lg text-sm focus:outline-none focus:border-brown-500 bg-white text-right"
                    />
                  )}
                </div>
              ))}
            </div>

            {/* Mark my share as already paid (the adder paid for the whole thing) */}
            <label className="mt-3 flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-xl cursor-pointer hover:bg-green-100 transition-colors">
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
          </div>
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
            {loading ? "Adding..." : "Add Expense"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
