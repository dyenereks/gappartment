"use client";
import { useState, useEffect } from "react";
import Modal from "./Modal";
import { BILL_TYPES, BILL_TYPE_LABELS, BILL_TYPE_ICONS, formatCurrency, displayName } from "@/lib/utils";

interface User {
  id: string;
  name: string;
  nickname?: string | null;
}

interface BillShare {
  id: string;
  amount: number;
  user: { id: string; name: string; nickname?: string | null };
}

interface Bill {
  id: string;
  type: string;
  amount: number;
  month: string;
  dueDate: string | null;
  description: string | null;
  receiver: { id: string; name: string };
  shares: BillShare[];
}

interface EditBillModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  bill: Bill | null;
  users: User[];
}

export default function EditBillModal({
  open,
  onClose,
  onSuccess,
  bill,
  users,
}: EditBillModalProps) {
  const [type, setType] = useState("RENT");
  const [amount, setAmount] = useState("");
  const [month, setMonth] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [description, setDescription] = useState("");
  const [receiverId, setReceiverId] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [splitMode, setSplitMode] = useState<"equal" | "custom">("equal");
  const [customShares, setCustomShares] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (bill) {
      setType(bill.type);
      setAmount(String(bill.amount));
      setMonth(bill.month);
      setDueDate(bill.dueDate ? bill.dueDate.slice(0, 10) : "");
      setDescription(bill.description ?? "");
      setReceiverId(bill.receiver.id);
      setError("");

      const existingIds = bill.shares.map((s) => s.user.id);
      setSelectedUserIds(existingIds);

      const existing: Record<string, string> = {};
      bill.shares.forEach((s) => { existing[s.user.id] = String(s.amount); });
      setCustomShares(existing);

      if (bill.shares.length > 0) {
        const equalAmt = bill.amount / bill.shares.length;
        const isEqual = bill.shares.every((s) => Math.abs(s.amount - equalAmt) < 0.01);
        setSplitMode(isEqual ? "equal" : "custom");
      } else {
        setSplitMode("equal");
      }
    }
  }, [bill]);

  const totalAmount = parseFloat(amount) || 0;
  const selectedUsers = users.filter((u) => selectedUserIds.includes(u.id));
  const equalShare = totalAmount > 0 && selectedUsers.length > 0
    ? totalAmount / selectedUsers.length
    : 0;

  const customTotal = selectedUsers.reduce(
    (sum, u) => sum + (parseFloat(customShares[u.id] || "0")),
    0
  );

  const toggleUser = (uid: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!totalAmount || totalAmount <= 0) {
      setError("Enter a valid amount");
      return;
    }
    if (selectedUsers.length === 0) {
      setError("Select at least one tenant");
      return;
    }

    let shares: { userId: string; amount: number }[];
    if (splitMode === "equal") {
      shares = selectedUsers.map((u) => ({ userId: u.id, amount: equalShare }));
    } else {
      const diff = Math.abs(customTotal - totalAmount);
      if (diff > 0.01) {
        setError(
          `Custom shares must equal total (${formatCurrency(totalAmount)}). Current: ${formatCurrency(customTotal)}`
        );
        return;
      }
      shares = selectedUsers.map((u) => ({
        userId: u.id,
        amount: parseFloat(customShares[u.id] || "0"),
      }));
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/bills/${bill!.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          amount: totalAmount,
          month,
          dueDate: dueDate || null,
          description: description.trim() || null,
          receiverId,
          shares,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update bill");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Edit Bill" size="lg">
      <form onSubmit={handleSubmit} className="p-5 space-y-5">
        <div>
          <label className="block text-sm font-medium text-charcoal-400 mb-2">Bill Type</label>
          <div className="grid grid-cols-3 gap-2">
            {BILL_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 text-sm font-medium transition-all ${
                  type === t
                    ? "border-brown-600 bg-brown-600 text-white"
                    : "border-cream-400 bg-white text-charcoal-400 hover:border-brown-300"
                }`}
              >
                <span className="text-xl">{BILL_TYPE_ICONS[t]}</span>
                {BILL_TYPE_LABELS[t]}
              </button>
            ))}
          </div>
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

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-charcoal-400 mb-1.5">
              Due Date <span className="text-charcoal-200">(optional)</span>
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-3 py-2.5 border border-cream-400 rounded-xl text-sm focus:outline-none focus:border-brown-500 bg-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-charcoal-400 mb-1.5">
              Receiver
            </label>
            <select
              value={receiverId}
              onChange={(e) => setReceiverId(e.target.value)}
              className="w-full px-3 py-2.5 border border-cream-400 rounded-xl text-sm focus:outline-none focus:border-brown-500 bg-white"
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>{displayName(u)}</option>
              ))}
            </select>
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
            placeholder="e.g. April reading"
            className="w-full px-3 py-2.5 border border-cream-400 rounded-xl text-sm focus:outline-none focus:border-brown-500 bg-white"
          />
        </div>

        {/* Tenant selection */}
        <div>
          <label className="block text-sm font-medium text-charcoal-400 mb-2">
            Tenants sharing this bill
          </label>
          <div className="space-y-2">
            {users.map((u) => (
              <label
                key={u.id}
                className="flex items-center gap-3 p-3 bg-cream-100 rounded-xl cursor-pointer hover:bg-cream-200 transition-colors"
              >
                <input
                  type="checkbox"
                  checked={selectedUserIds.includes(u.id)}
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

        {/* Split */}
        {selectedUsers.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-charcoal-400 mb-2">
              Split Method
            </label>
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
              {selectedUsers.map((u) => (
                <div key={u.id} className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-brown-300 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                    {displayName(u).charAt(0).toUpperCase()}
                  </div>
                  <span className="flex-1 text-sm text-charcoal-400">{displayName(u)}</span>
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
              {splitMode === "custom" && amount && (
                <div className="pt-2 border-t border-cream-400 flex justify-between text-sm">
                  <span className="text-charcoal-300">Total assigned</span>
                  <span
                    className={`font-semibold ${
                      Math.abs(customTotal - totalAmount) < 0.01 ? "text-green-600" : "text-red-500"
                    }`}
                  >
                    {formatCurrency(customTotal)} / {formatCurrency(totalAmount)}
                  </span>
                </div>
              )}
            </div>
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
            {loading ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
