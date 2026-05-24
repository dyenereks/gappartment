"use client";
import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import Modal from "./Modal";
import Icon from "./Icon";
import Avatar from "./Avatar";
import {
  displayName,
  formatCurrency,
  getCurrentMonth,
} from "@/lib/utils";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

interface User {
  _id: Id<"users">;
  name: string;
  nickname?: string | null;
}

interface AddExpenseModalProps {
  open: boolean;
  onClose: () => void;
  users: User[];
  currentUserId?: Id<"users">;
  defaultMonth?: string;
}

export default function AddExpenseModal({
  open,
  onClose,
  users,
  currentUserId,
  defaultMonth,
}: AddExpenseModalProps) {
  const create = useMutation(api.expenses.create);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [month, setMonth] = useState(defaultMonth ?? getCurrentMonth());
  const [splitMode, setSplitMode] = useState<"equal" | "custom">("equal");
  const [selectedUsers, setSelectedUsers] = useState<Id<"users">[]>([]);
  const [customShares, setCustomShares] = useState<Record<string, string>>({});
  const [markMyShareAsPaid, setMarkMyShareAsPaid] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setSelectedUsers(
        users.filter((u) => u._id !== currentUserId).map((u) => u._id)
      );
      setMarkMyShareAsPaid(false);
    }
  }, [open, users, currentUserId]);

  useEffect(() => {
    if (defaultMonth) setMonth(defaultMonth);
  }, [defaultMonth]);

  const toggleUser = (userId: Id<"users">) =>
    setSelectedUsers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );

  const allParticipants: User[] = currentUserId
    ? [
        users.find((u) => u._id === currentUserId)!,
        ...users.filter((u) => selectedUsers.includes(u._id)),
      ].filter(Boolean)
    : [];
  const participantCount = allParticipants.length;
  const totalNum = parseFloat(amount) || 0;
  const equalShare =
    totalNum > 0 && participantCount > 0 ? totalNum / participantCount : 0;
  const customTotal = allParticipants.reduce(
    (sum, u) => sum + (parseFloat(customShares[u._id] || "0") || 0),
    0
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!totalNum || totalNum <= 0) {
      setError("Enter a valid amount");
      return;
    }
    if (!title.trim()) {
      setError("Enter a title");
      return;
    }
    if (!currentUserId) {
      setError("Not signed in yet");
      return;
    }
    if (selectedUsers.length === 0) {
      setError("Select at least one tenant to share with");
      return;
    }

    const allIds: Id<"users">[] = [currentUserId, ...selectedUsers];

    let shares: { userId: Id<"users">; amount: number; isPaid?: boolean }[];
    if (splitMode === "equal") {
      const shareAmt = totalNum / allIds.length;
      shares = allIds.map((uid) => ({ userId: uid, amount: shareAmt }));
    } else {
      const diff = Math.abs(customTotal - totalNum);
      if (diff > 0.01) {
        setError(
          `Custom shares must equal total (${formatCurrency(totalNum)}). Current: ${formatCurrency(customTotal)}`
        );
        return;
      }
      shares = allIds.map((uid) => ({
        userId: uid,
        amount: parseFloat(customShares[uid] || "0"),
      }));
    }

    if (markMyShareAsPaid) {
      shares = shares.map((s) =>
        s.userId === currentUserId ? { ...s, isPaid: true } : s
      );
    }

    setLoading(true);
    try {
      await create({
        title,
        description: description || null,
        amount: totalNum,
        month,
        shares,
      });
      onClose();
      setTitle("");
      setDescription("");
      setAmount("");
      setSplitMode("equal");
      setCustomShares({});
      setMarkMyShareAsPaid(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to add expense");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add expense"
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
            {loading ? "Adding…" : "Save expense"}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} style={{ display: "contents" }}>
        <div className="field">
          <label className="field-label">Description</label>
          <input
            className="input"
            placeholder="e.g. Saturday grocery run"
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
              placeholder="₱0.00"
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
            placeholder="Additional details…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="field">
          <label className="field-label">
            Share with{" "}
            <span className="muted">(you are always included)</span>
          </label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {users
              .filter((u) => u._id !== currentUserId)
              .map((u) => {
                const on = selectedUsers.includes(u._id);
                return (
                  <button
                    key={u._id}
                    type="button"
                    onClick={() => toggleUser(u._id)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "6px 12px",
                      border:
                        "1px solid " +
                        (on ? "var(--ink)" : "var(--line)"),
                      background: on ? "var(--ink)" : "var(--paper)",
                      color: on ? "var(--bg)" : "var(--ink)",
                      borderRadius: 999,
                      fontSize: 13,
                    }}
                  >
                    <Avatar user={u} size="sm" />
                    {displayName(u)}
                  </button>
                );
              })}
          </div>
        </div>

        {participantCount > 0 && (
          <div className="field">
            <label className="field-label">Split</label>
            <div className="seg">
              {(["equal", "custom"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  className={splitMode === m ? "active" : ""}
                  onClick={() => setSplitMode(m)}
                >
                  {m === "equal" ? "Equal" : "Custom"}
                </button>
              ))}
            </div>
            <div
              style={{
                marginTop: 10,
                background: "var(--bg-2)",
                borderRadius: 12,
                padding: 12,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              {allParticipants.map((u) => (
                <div key={u._id} className="flex center gap-3">
                  <Avatar user={u} size="sm" />
                  <div style={{ flex: 1, fontSize: 13 }}>
                    {displayName(u)}
                    {u._id === currentUserId && (
                      <span className="muted"> (you)</span>
                    )}
                  </div>
                  {splitMode === "equal" ? (
                    <div
                      className="serif tnum"
                      style={{ fontSize: 16, color: "var(--accent)" }}
                    >
                      {equalShare > 0 ? formatCurrency(equalShare) : "—"}
                    </div>
                  ) : (
                    <input
                      className="input tnum"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={customShares[u._id] ?? ""}
                      onChange={(e) =>
                        setCustomShares((p) => ({
                          ...p,
                          [u._id]: e.target.value,
                        }))
                      }
                      style={{
                        width: 120,
                        textAlign: "right",
                        padding: "6px 10px",
                      }}
                    />
                  )}
                </div>
              ))}
              {splitMode === "custom" && amount && (
                <div
                  className="flex center between"
                  style={{
                    paddingTop: 8,
                    borderTop: "1px solid var(--line)",
                    fontSize: 13,
                  }}
                >
                  <span className="muted">Total assigned</span>
                  <span
                    className="tnum"
                    style={{
                      fontWeight: 600,
                      color:
                        Math.abs(customTotal - totalNum) < 0.01
                          ? "var(--success)"
                          : "var(--danger)",
                    }}
                  >
                    {formatCurrency(customTotal)} / {formatCurrency(totalNum)}
                  </span>
                </div>
              )}
            </div>

            <label
              className="flex center gap-3"
              style={{
                cursor: "pointer",
                marginTop: 10,
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
                  You don&apos;t owe yourself — keep this on if you fronted
                  the cost.
                </div>
              </div>
            </label>
          </div>
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
