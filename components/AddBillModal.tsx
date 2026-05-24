"use client";
import { useEffect, useLayoutEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import Modal from "./Modal";
import Icon, { type IconName } from "./Icon";
import Avatar from "./Avatar";
import {
  BILL_TYPES,
  BILL_TYPE_ICON,
  BILL_TYPE_LABELS,
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
  imageUrl?: string | null;
}

interface AddBillModalProps {
  open: boolean;
  onClose: () => void;
  users: User[];
  currentUserId?: Id<"users">;
  defaultMonth?: string;
}

export default function AddBillModal({
  open,
  onClose,
  users,
  currentUserId,
  defaultMonth,
}: AddBillModalProps) {
  const create = useMutation(api.bills.create);

  const [type, setType] = useState("RENT");
  const [amount, setAmount] = useState("");
  const [acAmount, setAcAmount] = useState("");
  const [month, setMonth] = useState(defaultMonth ?? getCurrentMonth());
  const [receiverId, setReceiverId] = useState<Id<"users"> | "">(
    currentUserId ?? ""
  );
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<Id<"users">[]>(
    users.map((u) => u._id)
  );
  const [splitMode, setSplitMode] = useState<"equal" | "custom">("equal");
  const [customShares, setCustomShares] = useState<Record<string, string>>({});
  const [markMyShareAsPaid, setMarkMyShareAsPaid] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const existingBills = useQuery(
    api.bills.listByMonth,
    open ? { month } : "skip"
  );
  const takenTypes = new Set((existingBills ?? []).map((b) => b.type));
  const allTaken = BILL_TYPES.every((t) => takenTypes.has(t));

  useEffect(() => {
    if (defaultMonth) setMonth(defaultMonth);
  }, [defaultMonth]);

  useLayoutEffect(() => {
    if (open) {
      setSelectedUserIds(users.map((u) => u._id));
      setReceiverId(currentUserId ?? users[0]?._id ?? ("" as Id<"users">));
      setMarkMyShareAsPaid(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open || existingBills === undefined) return;
    if (takenTypes.has(type)) {
      const fallback = BILL_TYPES.find((t) => !takenTypes.has(t));
      if (fallback) setType(fallback);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, existingBills, month]);

  const selectedUsers = users.filter((u) => selectedUserIds.includes(u._id));
  const adminInSplit = !!currentUserId && selectedUserIds.includes(currentUserId);
  const showAcField =
    type === "ELECTRIC" && splitMode === "equal" && adminInSplit;
  const acNum = showAcField ? parseFloat(acAmount) || 0 : 0;
  const totalNum = parseFloat(amount) || 0;

  const equalShareFor = (uid: Id<"users">) => {
    if (selectedUsers.length === 0 || totalNum <= 0) return 0;
    if (acNum > 0 && acNum < totalNum) {
      const base = (totalNum - acNum) / selectedUsers.length;
      return uid === currentUserId ? base + acNum : base;
    }
    return totalNum / selectedUsers.length;
  };

  const customTotal = selectedUsers.reduce(
    (sum, u) => sum + (parseFloat(customShares[u._id] || "0")),
    0
  );

  const toggleUser = (uid: Id<"users">) =>
    setSelectedUserIds((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!totalNum || totalNum <= 0) {
      setError("Enter a valid amount");
      return;
    }
    if (!receiverId) {
      setError("Pick a receiver");
      return;
    }
    if (selectedUsers.length === 0) {
      setError("Select at least one tenant");
      return;
    }

    let shares: { userId: Id<"users">; amount: number; isPaid?: boolean }[];
    if (splitMode === "equal") {
      if (acNum > 0) {
        if (acNum >= totalNum) {
          setError("AC consumption must be less than the total bill");
          return;
        }
        if (!currentUserId || !selectedUserIds.includes(currentUserId)) {
          setError(
            "You must be one of the tenants to attribute AC consumption to yourself"
          );
          return;
        }
        const base = (totalNum - acNum) / selectedUsers.length;
        shares = selectedUsers.map((u) => ({
          userId: u._id,
          amount: u._id === currentUserId ? base + acNum : base,
        }));
      } else {
        const shareAmt = totalNum / selectedUsers.length;
        shares = selectedUsers.map((u) => ({
          userId: u._id,
          amount: shareAmt,
        }));
      }
    } else {
      const diff = Math.abs(customTotal - totalNum);
      if (diff > 0.01) {
        setError(
          `Custom shares must equal total (${formatCurrency(totalNum)}). Current: ${formatCurrency(customTotal)}`
        );
        return;
      }
      shares = selectedUsers.map((u) => ({
        userId: u._id,
        amount: parseFloat(customShares[u._id] || "0"),
      }));
    }

    if (markMyShareAsPaid && currentUserId) {
      shares = shares.map((s) =>
        s.userId === currentUserId ? { ...s, isPaid: true } : s
      );
    }

    setLoading(true);
    try {
      await create({
        type,
        amount: totalNum,
        month,
        receiverId: receiverId as Id<"users">,
        description: description || null,
        dueDate: dueDate ? new Date(dueDate).getTime() : null,
        shares,
        acAmount: showAcField && acNum > 0 ? acNum : null,
      });
      onClose();
      setType("RENT");
      setAmount("");
      setAcAmount("");
      setDescription("");
      setDueDate("");
      setSplitMode("equal");
      setCustomShares({});
      setMarkMyShareAsPaid(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to add bill");
    } finally {
      setLoading(false);
    }
  };

  const disabledSubmit = loading || allTaken || takenTypes.has(type);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add a new bill"
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
            disabled={disabledSubmit}
          >
            <Icon name="check" size={14} />
            {loading ? "Adding…" : "Create bill"}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} style={{ display: "contents" }}>
        {/* Type */}
        <div className="field">
          <label className="field-label">Type</label>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${BILL_TYPES.length}, 1fr)`,
              gap: 8,
            }}
          >
            {BILL_TYPES.map((t) => {
              const taken = takenTypes.has(t);
              const selected = type === t;
              const icon = (BILL_TYPE_ICON[t] ?? "receipt") as IconName;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => !taken && setType(t)}
                  disabled={taken}
                  title={taken ? "Already added for this month" : undefined}
                  style={{
                    padding: "14px 8px",
                    border:
                      "1px solid " +
                      (selected ? "var(--ink)" : "var(--line)"),
                    background: selected
                      ? "var(--ink)"
                      : taken
                        ? "var(--bg-2)"
                        : "var(--paper)",
                    color: selected
                      ? "var(--bg)"
                      : taken
                        ? "var(--ink-faint)"
                        : "var(--ink)",
                    borderRadius: 10,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 6,
                    cursor: taken ? "not-allowed" : "pointer",
                  }}
                >
                  <Icon name={icon} size={18} />
                  <span style={{ fontSize: 12 }}>{BILL_TYPE_LABELS[t]}</span>
                  {taken && (
                    <span style={{ fontSize: 10 }} className="muted">
                      Already added
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {allTaken && (
            <div
              style={{
                marginTop: 8,
                fontSize: 12,
                color: "oklch(from var(--warning) calc(l - 0.2) c h)",
                background: "var(--warning-soft)",
                padding: "8px 12px",
                borderRadius: 10,
              }}
            >
              Every bill type already exists for this month. Switch to another
              month or edit the existing bill.
            </div>
          )}
        </div>

        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: "1fr 1fr" }}
        >
          <div className="field">
            <label className="field-label">Total amount</label>
            <input
              className="input tnum"
              placeholder="₱0.00"
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

        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: "1fr 1fr" }}
        >
          <div className="field">
            <label className="field-label">
              Due date <span className="muted">(optional)</span>
            </label>
            <input
              className="input"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
          <div className="field">
            <label className="field-label">Receiver (collects payment)</label>
            <select
              className="select"
              value={receiverId}
              onChange={(e) => setReceiverId(e.target.value as Id<"users">)}
            >
              {users.map((u) => (
                <option key={u._id} value={u._id}>
                  {displayName(u)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="field">
          <label className="field-label">
            Notes <span className="muted">(optional)</span>
          </label>
          <input
            className="input"
            placeholder="e.g. April reading"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {showAcField && (
          <div className="field">
            <label className="field-label">
              AC consumption (₱){" "}
              <span className="muted">(charged entirely to you)</span>
            </label>
            <input
              className="input tnum"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={acAmount}
              onChange={(e) => setAcAmount(e.target.value)}
            />
            <div className="muted" style={{ fontSize: 12 }}>
              Subtracted from the total; everyone else splits what&apos;s left
              equally.
            </div>
          </div>
        )}

        <div className="field">
          <label className="field-label">Tenants sharing this bill</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {users.map((u) => {
              const on = selectedUserIds.includes(u._id);
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
                      "1px solid " + (on ? "var(--ink)" : "var(--line)"),
                    background: on ? "var(--ink)" : "var(--paper)",
                    color: on ? "var(--bg)" : "var(--ink)",
                    borderRadius: 999,
                    fontSize: 13,
                  }}
                >
                  <Avatar user={u} size="sm" />
                  {displayName(u)}
                  {u._id === currentUserId && (
                    <span style={{ opacity: 0.7 }}>· you</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {selectedUsers.length > 0 && (
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
              {selectedUsers.map((u) => (
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
                      {totalNum > 0
                        ? formatCurrency(equalShareFor(u._id))
                        : "—"}
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

            {currentUserId && selectedUserIds.includes(currentUserId) && (
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
                    Useful when you (as receiver) are also a tenant.
                  </div>
                </div>
              </label>
            )}
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
