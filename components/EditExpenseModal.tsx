"use client";
import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import Modal from "./Modal";
import Icon from "./Icon";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

type Expense = FunctionReturnType<typeof api.expenses.listByMonth>[number];

interface EditExpenseModalProps {
  open: boolean;
  onClose: () => void;
  expense: Expense | null;
  currentUserId?: Id<"users">;
}

export default function EditExpenseModal({
  open,
  onClose,
  expense,
  currentUserId,
}: EditExpenseModalProps) {
  const update = useMutation(api.expenses.update);

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
    if (!expense) return;
    setTitle(expense.title);
    setDescription(expense.description ?? "");
    setAmount(String(expense.amount));
    setMonth(expense.month);
    setError("");
    const myShare = expense.shares.find((s) => s.user?._id === currentUserId);
    const wasPaid = myShare?.isPaid ?? false;
    setHasMyShare(!!myShare);
    setMyShareWasPaid(wasPaid);
    setMarkMyShareAsPaid(wasPaid);
  }, [expense, currentUserId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const totalNum = parseFloat(amount);
    if (!totalNum || totalNum <= 0) {
      setError("Enter a valid amount");
      return;
    }
    if (!title.trim()) {
      setError("Enter a title");
      return;
    }

    setLoading(true);
    try {
      await update({
        expenseId: expense!._id,
        title: title.trim(),
        description: description.trim() || null,
        amount: totalNum,
        month,
        ...(hasMyShare && markMyShareAsPaid !== myShareWasPaid
          ? { markMyShareAsPaid }
          : {}),
      });
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update expense");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit expense"
      size="lg"
      footer={
        <>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={loading}
          >
            <Icon name="check" size={14} />
            {loading ? "Saving…" : "Save changes"}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} style={{ display: "contents" }}>
        <div className="field">
          <label className="field-label">Description</label>
          <input
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div className="grid gap-3" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div className="field">
            <label className="field-label">Amount</label>
            <input
              className="input tnum"
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="field">
            <label className="field-label">Period</label>
            <input
              className="input"
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
          </div>
        </div>
        <div className="field">
          <label className="field-label">
            Notes <span className="muted">(optional)</span>
          </label>
          <input
            className="input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div
          className="muted"
          style={{
            fontSize: 12,
            background: "var(--bg-2)",
            padding: "8px 12px",
            borderRadius: 10,
          }}
        >
          Changing the amount recalculates every share equally.
        </div>

        {hasMyShare && (
          <label
            className="flex center gap-3"
            style={{
              cursor: "pointer",
              padding: 10,
              background: "var(--success-soft)",
              borderRadius: 10,
              color: "var(--success)",
            }}
          >
            <input
              type="checkbox"
              checked={markMyShareAsPaid}
              onChange={(e) => setMarkMyShareAsPaid(e.target.checked)}
              style={{ accentColor: "var(--success)" }}
            />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 500, fontSize: 13 }}>
                Mark my share as already paid
              </div>
              <div style={{ fontSize: 11, opacity: 0.85 }}>
                You don&apos;t owe yourself.
              </div>
            </div>
          </label>
        )}

        {error && (
          <div
            style={{
              color: "var(--danger)",
              background: "var(--danger-soft)",
              padding: 10,
              borderRadius: 10,
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}
      </form>
    </Modal>
  );
}
