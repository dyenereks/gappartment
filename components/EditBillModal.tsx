"use client";
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import Modal from "./Modal";
import Icon, { type IconName } from "./Icon";
import Avatar from "./Avatar";
import {
  BILL_TYPES,
  BILL_TYPE_ICON,
  BILL_TYPE_LABELS,
  displayName,
  formatCurrency,
} from "@/lib/utils";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

interface User {
  _id: Id<"users">;
  name: string;
  nickname?: string | null;
}

type Bill = FunctionReturnType<typeof api.bills.listByMonth>[number];

interface EditBillModalProps {
  open: boolean;
  onClose: () => void;
  bill: Bill | null;
  users: User[];
  currentUserId?: Id<"users">;
}

export default function EditBillModal({
  open,
  onClose,
  bill,
  users,
  currentUserId,
}: EditBillModalProps) {
  const update = useMutation(api.bills.update);

  const [type, setType] = useState("RENT");
  const [amount, setAmount] = useState("");
  const [acAmount, setAcAmount] = useState("");
  const [month, setMonth] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [description, setDescription] = useState("");
  const [receiverId, setReceiverId] = useState<Id<"users"> | "">("");
  const [selectedUserIds, setSelectedUserIds] = useState<Id<"users">[]>([]);
  const [splitMode, setSplitMode] = useState<"equal" | "custom">("equal");
  const [customShares, setCustomShares] = useState<Record<string, string>>({});
  const [markMyShareAsPaid, setMarkMyShareAsPaid] = useState(false);
  const [myShareWasPaid, setMyShareWasPaid] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const existingBills = useQuery(
    api.bills.listByMonth,
    open && month ? { month } : "skip"
  );
  const takenTypes = new Set(
    (existingBills ?? [])
      .filter((b) => b._id !== bill?._id)
      .map((b) => b.type)
  );

  useEffect(() => {
    if (!bill) return;
    setType(bill.type);
    setAmount(String(bill.amount));
    setMonth(bill.month);
    setDueDate(
      bill.dueDate ? new Date(bill.dueDate).toISOString().slice(0, 10) : ""
    );
    setDescription(bill.description ?? "");
    setReceiverId(bill.receiverId);
    setError("");

    const existingIds = bill.shares
      .map((s) => s.user?._id)
      .filter((id): id is Id<"users"> => !!id);
    setSelectedUserIds(existingIds);

    const exist: Record<string, string> = {};
    bill.shares.forEach((s) => {
      if (s.user) exist[s.user._id] = String(s.amount);
    });
    setCustomShares(exist);

    const billAc = bill.acAmount ?? 0;
    setAcAmount(billAc > 0 ? String(billAc) : "");

    if (bill.shares.length > 0) {
      if (billAc > 0) {
        const base = (bill.amount - billAc) / bill.shares.length;
        const adminShareTarget = base + billAc;
        const isEqualWithAc = bill.shares.every((s) => {
          const expected =
            s.user?._id === bill.addedBy?._id ? adminShareTarget : base;
          return Math.abs(s.amount - expected) < 0.01;
        });
        setSplitMode(isEqualWithAc ? "equal" : "custom");
      } else {
        const equalAmt = bill.amount / bill.shares.length;
        const isEqual = bill.shares.every(
          (s) => Math.abs(s.amount - equalAmt) < 0.01
        );
        setSplitMode(isEqual ? "equal" : "custom");
      }
    } else {
      setSplitMode("equal");
    }

    const myShare = bill.shares.find((s) => s.user?._id === currentUserId);
    const wasPaid = myShare?.isPaid ?? false;
    setMyShareWasPaid(wasPaid);
    setMarkMyShareAsPaid(wasPaid);
  }, [bill, currentUserId]);

  const totalAmount = parseFloat(amount) || 0;
  const selectedUsers = users.filter((u) => selectedUserIds.includes(u._id));
  const adminInSplit = !!currentUserId && selectedUserIds.includes(currentUserId);
  const showAcField =
    type === "ELECTRIC" && splitMode === "equal" && adminInSplit;
  const acNum = showAcField ? parseFloat(acAmount) || 0 : 0;

  const equalShareFor = (uid: Id<"users">) => {
    if (selectedUsers.length === 0 || totalAmount <= 0) return 0;
    if (acNum > 0 && acNum < totalAmount) {
      const base = (totalAmount - acNum) / selectedUsers.length;
      return uid === currentUserId ? base + acNum : base;
    }
    return totalAmount / selectedUsers.length;
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
    if (!totalAmount || totalAmount <= 0) {
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
        if (acNum >= totalAmount) {
          setError("AC consumption must be less than the total bill");
          return;
        }
        const base = (totalAmount - acNum) / selectedUsers.length;
        shares = selectedUsers.map((u) => ({
          userId: u._id,
          amount: u._id === currentUserId ? base + acNum : base,
        }));
      } else {
        const shareAmt = totalAmount / selectedUsers.length;
        shares = selectedUsers.map((u) => ({
          userId: u._id,
          amount: shareAmt,
        }));
      }
    } else {
      const diff = Math.abs(customTotal - totalAmount);
      if (diff > 0.01) {
        setError(
          `Custom shares must equal total (${formatCurrency(totalAmount)}). Current: ${formatCurrency(customTotal)}`
        );
        return;
      }
      shares = selectedUsers.map((u) => ({
        userId: u._id,
        amount: parseFloat(customShares[u._id] || "0"),
      }));
    }

    if (
      currentUserId &&
      selectedUserIds.includes(currentUserId) &&
      markMyShareAsPaid !== myShareWasPaid
    ) {
      shares = shares.map((s) =>
        s.userId === currentUserId ? { ...s, isPaid: markMyShareAsPaid } : s
      );
    }

    setLoading(true);
    try {
      await update({
        billId: bill!._id,
        type,
        amount: totalAmount,
        month,
        dueDate: dueDate ? new Date(dueDate).getTime() : null,
        description: description.trim() || null,
        receiverId: receiverId as Id<"users">,
        shares,
        acAmount: showAcField && acNum > 0 ? acNum : null,
      });
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update bill");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit bill"
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
            disabled={loading || takenTypes.has(type)}
          >
            <Icon name="check" size={14} />
            {loading ? "Saving…" : "Save changes"}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} style={{ display: "contents" }}>
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
        </div>

        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: "1fr 1fr" }}
        >
          <div className="field">
            <label className="field-label">Total amount</label>
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
            <label className="field-label">Receiver</label>
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
                  </div>
                  {splitMode === "equal" ? (
                    <div
                      className="serif tnum"
                      style={{ fontSize: 16, color: "var(--accent)" }}
                    >
                      {totalAmount > 0
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
                        Math.abs(customTotal - totalAmount) < 0.01
                          ? "var(--success)"
                          : "var(--danger)",
                    }}
                  >
                    {formatCurrency(customTotal)} /{" "}
                    {formatCurrency(totalAmount)}
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
