"use client";
import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import PageHead from "@/components/PageHead";
import MonthPicker from "@/components/MonthPicker";
import Avatar from "@/components/Avatar";
import Badge from "@/components/Badge";
import Icon from "@/components/Icon";
import PaymentModal from "@/components/PaymentModal";
import MultiPaymentModal, {
  type SelectedShare,
} from "@/components/MultiPaymentModal";
import ConfirmPaymentModal from "@/components/ConfirmPaymentModal";
import {
  BILL_TYPE_ICON,
  BILL_TYPE_LABELS,
  displayName,
  formatCurrency,
  formatMonth,
  getCurrentMonth,
} from "@/lib/utils";
import { api } from "@/convex/_generated/api";
import type { IconName } from "@/components/Icon";
import type { Id, Doc } from "@/convex/_generated/dataModel";

type PaymentMethod = Doc<"paymentMethods">;
type Tab = "outgoing" | "incoming";

export default function PaymentsPage() {
  const [month, setMonth] = useState(getCurrentMonth());
  const [tab, setTab] = useState<Tab>("outgoing");

  const me = useQuery(api.users.current);
  const bills = useQuery(api.bills.listByMonth, { month });
  const expenses = useQuery(api.expenses.listByMonth, { month });

  const [payModal, setPayModal] = useState<
    | {
        shareId: Id<"billShares">;
        type: "bill";
        amount: number;
        receiverName: string;
        paymentMethods: PaymentMethod[];
      }
    | {
        shareId: Id<"expenseShares">;
        type: "expense";
        amount: number;
        receiverName: string;
        paymentMethods: PaymentMethod[];
      }
    | null
  >(null);

  const [confirmModal, setConfirmModal] = useState<
    | {
        shareId: Id<"billShares">;
        type: "bill";
        amount: number;
        payerName: string;
        proofUrl: string;
      }
    | {
        shareId: Id<"expenseShares">;
        type: "expense";
        amount: number;
        payerName: string;
        proofUrl: string;
      }
    | null
  >(null);

  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [multiPayOpen, setMultiPayOpen] = useState(false);

  useEffect(() => {
    setSelectedKeys(new Set());
    setMultiPayOpen(false);
  }, [tab, month]);

  const loading = me === undefined || bills === undefined || expenses === undefined;
  const myId = me?._id;

  // ===== Outgoing
  const outgoingBills = (bills ?? [])
    .filter((b) => b.receiver?._id !== myId)
    .flatMap((b) =>
      b.shares
        .filter((s) => s.user?._id === myId)
        .map((s) => ({ ...s, bill: b }))
    );
  const outgoingExpenses = (expenses ?? [])
    .filter((e) => e.addedBy?._id !== myId)
    .flatMap((e) =>
      e.shares
        .filter((s) => s.user?._id === myId)
        .map((s) => ({ ...s, expense: e }))
    );

  // ===== Incoming
  const incomingBills = (bills ?? [])
    .filter((b) => b.receiver?._id === myId)
    .flatMap((b) =>
      b.shares
        .filter((s) => s.user?._id !== myId)
        .map((s) => ({ ...s, bill: b }))
    );
  const incomingExpenses = (expenses ?? [])
    .filter((e) => e.addedBy?._id === myId)
    .flatMap((e) =>
      e.shares
        .filter((s) => s.user?._id !== myId)
        .map((s) => ({ ...s, expense: e }))
    );

  // ===== Money summary stats
  const sent = [...outgoingBills, ...outgoingExpenses]
    .filter((s) => s.isPaid)
    .reduce((sum, s) => sum + s.amount, 0);
  const received = [...incomingBills, ...incomingExpenses]
    .filter((s) => s.isPaid)
    .reduce((sum, s) => sum + s.amount, 0);
  const unpaidOutgoing = [...outgoingBills, ...outgoingExpenses].filter(
    (s) => !s.isPaid
  ).length;
  const pendingIncoming = [...incomingBills, ...incomingExpenses].filter(
    (s) => s.proofUrl && !s.isPaid
  ).length;

  // ===== Multi-select
  const keyOf = (kind: "bill" | "expense", id: string) => `${kind}:${id}`;
  const selectableBills = outgoingBills.filter(
    (i) => !i.isPaid && !i.proofUrl && i.bill.receiver
  );
  const selectableExpenses = outgoingExpenses.filter(
    (i) => !i.isPaid && !i.proofUrl && i.expense.addedBy
  );
  const selectedBills = selectableBills.filter((i) =>
    selectedKeys.has(keyOf("bill", i._id))
  );
  const selectedExpenses = selectableExpenses.filter((i) =>
    selectedKeys.has(keyOf("expense", i._id))
  );
  const selectedItems: SelectedShare[] = [
    ...selectedBills.map((i) => ({
      kind: "bill" as const,
      shareId: i._id,
      label: BILL_TYPE_LABELS[i.bill.type] ?? i.bill.type,
      amount: i.amount,
    })),
    ...selectedExpenses.map((i) => ({
      kind: "expense" as const,
      shareId: i._id,
      label: i.expense.title,
      amount: i.amount,
    })),
  ];
  const selectedTotal = selectedItems.reduce((s, i) => s + i.amount, 0);
  const receiverMap = new Map<
    string,
    { id: Id<"users">; name: string; paymentMethods: PaymentMethod[] }
  >();
  for (const i of selectedBills) {
    if (!i.bill.receiver) continue;
    const r = i.bill.receiver;
    receiverMap.set(r._id, {
      id: r._id,
      name: displayName(r),
      paymentMethods: r.paymentMethods,
    });
  }
  for (const i of selectedExpenses) {
    if (!i.expense.addedBy) continue;
    const r = i.expense.addedBy;
    receiverMap.set(r._id, {
      id: r._id,
      name: displayName(r),
      paymentMethods: r.paymentMethods,
    });
  }
  const uniqueReceivers = Array.from(receiverMap.values());
  const singleReceiver = uniqueReceivers.length === 1 ? uniqueReceivers[0] : null;
  const toggleKey = (k: string) =>
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      next.has(k) ? next.delete(k) : next.add(k);
      return next;
    });
  const selectAll = () =>
    setSelectedKeys(
      new Set([
        ...selectableBills.map((i) => keyOf("bill", i._id)),
        ...selectableExpenses.map((i) => keyOf("expense", i._id)),
      ])
    );
  const clearSelection = () => setSelectedKeys(new Set());
  const totalSelectable = selectableBills.length + selectableExpenses.length;
  const allSelected =
    totalSelectable > 0 && selectedKeys.size === totalSelectable;

  return (
    <div>
      <PageHead
        eyebrow="Money movements"
        title={`<em>Payments</em> ledger`}
        sub="Every peso in and out — recorded."
        action={<MonthPicker value={month} onChange={setMonth} />}
      />

      {/* Stats */}
      <div className="cols-3">
        <StatCard
          label="Received"
          amount={received}
          meta={`${pendingIncoming} awaiting confirmation`}
          icon="arrow-down"
          tint="success"
        />
        <StatCard
          label="Sent"
          amount={sent}
          meta={`${unpaidOutgoing} unpaid share${unpaidOutgoing === 1 ? "" : "s"}`}
          icon="arrow-up"
          tint="accent"
        />
        <StatCard
          label="Net"
          amount={received - sent}
          meta={`for ${formatMonth(month)}`}
          icon="wallet"
          tint="ink"
        />
      </div>

      {/* Tabs */}
      <div className="tabs" style={{ marginTop: 24 }}>
        {(
          [
            { id: "outgoing" as Tab, label: "I owe" },
            { id: "incoming" as Tab, label: "Owed to me" },
          ]
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            className={tab === t.id ? "active" : ""}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "outgoing" ? (
        <div className="card card-lg">
          {totalSelectable > 0 && (
            <div
              className="flex center between"
              style={{ marginBottom: 12, flexWrap: "wrap", gap: 12 }}
            >
              <div className="muted" style={{ fontSize: 13 }}>
                {totalSelectable} item{totalSelectable === 1 ? "" : "s"} you can pay
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={allSelected ? clearSelection : selectAll}
              >
                {allSelected ? "Clear selection" : "Select all"}
              </button>
            </div>
          )}

          {loading ? (
            <div className="muted" style={{ padding: 24 }}>
              Loading…
            </div>
          ) : outgoingBills.length === 0 && outgoingExpenses.length === 0 ? (
            <EmptyState
              title="All caught up."
              sub={`Nothing to pay for ${formatMonth(month)}.`}
            />
          ) : (
            <>
              {outgoingBills.map((item) => {
                const selectable =
                  !item.isPaid && !item.proofUrl && !!item.bill.receiver;
                const k = keyOf("bill", item._id);
                const iconName = (BILL_TYPE_ICON[item.bill.type] ?? "receipt") as IconName;
                return (
                  <PayRow
                    key={item._id}
                    selectable={selectable}
                    selected={selectedKeys.has(k)}
                    onToggle={() => toggleKey(k)}
                    icon={iconName}
                    title={BILL_TYPE_LABELS[item.bill.type] ?? item.bill.type}
                    sub={`Pay to ${
                      item.bill.receiver ? displayName(item.bill.receiver) : "—"
                    }`}
                    amount={item.amount}
                    status={renderStatus(item)}
                    action={
                      !item.isPaid && !item.proofUrl && item.bill.receiver ? (
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() =>
                            setPayModal({
                              shareId: item._id,
                              type: "bill",
                              amount: item.amount,
                              receiverName: displayName(item.bill.receiver!),
                              paymentMethods: item.bill.receiver!.paymentMethods,
                            })
                          }
                        >
                          Pay
                        </button>
                      ) : null
                    }
                  />
                );
              })}
              {outgoingExpenses.map((item) => {
                const selectable =
                  !item.isPaid && !item.proofUrl && !!item.expense.addedBy;
                const k = keyOf("expense", item._id);
                return (
                  <PayRow
                    key={item._id}
                    selectable={selectable}
                    selected={selectedKeys.has(k)}
                    onToggle={() => toggleKey(k)}
                    icon="tag"
                    title={item.expense.title}
                    sub={`Pay to ${
                      item.expense.addedBy
                        ? displayName(item.expense.addedBy)
                        : "—"
                    }`}
                    amount={item.amount}
                    status={renderStatus(item)}
                    action={
                      !item.isPaid && !item.proofUrl && item.expense.addedBy ? (
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() =>
                            setPayModal({
                              shareId: item._id,
                              type: "expense",
                              amount: item.amount,
                              receiverName: displayName(item.expense.addedBy!),
                              paymentMethods: item.expense.addedBy!.paymentMethods,
                            })
                          }
                        >
                          Pay
                        </button>
                      ) : null
                    }
                  />
                );
              })}
            </>
          )}
        </div>
      ) : (
        <div className="card card-lg">
          {loading ? (
            <div className="muted" style={{ padding: 24 }}>
              Loading…
            </div>
          ) : incomingBills.length === 0 && incomingExpenses.length === 0 ? (
            <EmptyState
              title="Nothing owed to you."
              sub={`For ${formatMonth(month)}.`}
            />
          ) : (
            <>
              {incomingBills.map((item) => {
                const iconName = (BILL_TYPE_ICON[item.bill.type] ?? "receipt") as IconName;
                return (
                  <PayRow
                    key={item._id}
                    icon={iconName}
                    title={BILL_TYPE_LABELS[item.bill.type] ?? item.bill.type}
                    sub={`From ${item.user ? displayName(item.user) : "—"}`}
                    amount={item.amount}
                    status={renderStatus(item)}
                    leadingAvatar={item.user ?? undefined}
                    action={
                      item.proofUrl && !item.isPaid && item.user ? (
                        <button
                          type="button"
                          className="btn btn-accent btn-sm"
                          onClick={() =>
                            setConfirmModal({
                              shareId: item._id,
                              type: "bill",
                              amount: item.amount,
                              payerName: displayName(item.user!),
                              proofUrl: item.proofUrl!,
                            })
                          }
                        >
                          Review
                        </button>
                      ) : null
                    }
                  />
                );
              })}
              {incomingExpenses.map((item) => (
                <PayRow
                  key={item._id}
                  icon="tag"
                  title={item.expense.title}
                  sub={`From ${item.user ? displayName(item.user) : "—"}`}
                  amount={item.amount}
                  status={renderStatus(item)}
                  leadingAvatar={item.user ?? undefined}
                  action={
                    item.proofUrl && !item.isPaid && item.user ? (
                      <button
                        type="button"
                        className="btn btn-accent btn-sm"
                        onClick={() =>
                          setConfirmModal({
                            shareId: item._id,
                            type: "expense",
                            amount: item.amount,
                            payerName: displayName(item.user!),
                            proofUrl: item.proofUrl!,
                          })
                        }
                      >
                        Review
                      </button>
                    ) : null
                  }
                />
              ))}
            </>
          )}
        </div>
      )}

      {/* Sticky multi-select bar */}
      {tab === "outgoing" && selectedItems.length > 0 && (
        <div className="action-bar">
          <div className="action-bar-inner">
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>
                {selectedItems.length} selected · {formatCurrency(selectedTotal)}
              </div>
              <div
                style={{
                  fontSize: 12,
                  opacity: 0.85,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {singleReceiver
                  ? `to ${singleReceiver.name}`
                  : `${uniqueReceivers.length} different recipients — pick one at a time`}
              </div>
            </div>
            <button
              type="button"
              onClick={clearSelection}
              className="btn btn-sm"
              style={{
                background: "oklch(1 0 0 / 0.12)",
                color: "var(--bg)",
                borderColor: "oklch(1 0 0 / 0.18)",
              }}
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => setMultiPayOpen(true)}
              disabled={!singleReceiver}
              title={
                !singleReceiver
                  ? "Selected items must have the same recipient"
                  : undefined
              }
              className="btn btn-sm"
              style={{ background: "var(--bg)", color: "var(--ink)" }}
            >
              Pay now
            </button>
          </div>
        </div>
      )}

      {/* Pay one-share modal — branch by type for TS narrowing */}
      {payModal?.type === "bill" && (
        <PaymentModal
          open={true}
          onClose={() => setPayModal(null)}
          shareId={payModal.shareId}
          shareType="bill"
          amount={payModal.amount}
          receiverName={payModal.receiverName}
          paymentMethods={payModal.paymentMethods}
        />
      )}
      {payModal?.type === "expense" && (
        <PaymentModal
          open={true}
          onClose={() => setPayModal(null)}
          shareId={payModal.shareId}
          shareType="expense"
          amount={payModal.amount}
          receiverName={payModal.receiverName}
          paymentMethods={payModal.paymentMethods}
        />
      )}

      {confirmModal?.type === "bill" && (
        <ConfirmPaymentModal
          open={true}
          onClose={() => setConfirmModal(null)}
          shareId={confirmModal.shareId}
          shareType="bill"
          amount={confirmModal.amount}
          payerName={confirmModal.payerName}
          proofUrl={confirmModal.proofUrl}
        />
      )}
      {confirmModal?.type === "expense" && (
        <ConfirmPaymentModal
          open={true}
          onClose={() => setConfirmModal(null)}
          shareId={confirmModal.shareId}
          shareType="expense"
          amount={confirmModal.amount}
          payerName={confirmModal.payerName}
          proofUrl={confirmModal.proofUrl}
        />
      )}

      {singleReceiver && (
        <MultiPaymentModal
          open={multiPayOpen}
          onClose={() => {
            setMultiPayOpen(false);
            clearSelection();
          }}
          receiverName={singleReceiver.name}
          paymentMethods={singleReceiver.paymentMethods}
          items={selectedItems}
        />
      )}
    </div>
  );
}

function renderStatus(s: { isPaid: boolean; proofUrl?: string | null }) {
  if (s.isPaid)
    return (
      <Badge kind="success" dot>
        Paid
      </Badge>
    );
  if (s.proofUrl)
    return (
      <Badge kind="warning" dot>
        Awaiting confirmation
      </Badge>
    );
  return (
    <Badge kind="danger" dot>
      Unpaid
    </Badge>
  );
}

function StatCard({
  label,
  amount,
  meta,
  icon,
  tint,
}: {
  label: string;
  amount: number;
  meta: string;
  icon: IconName;
  tint: "success" | "accent" | "ink";
}) {
  const tintBg =
    tint === "success"
      ? "var(--success-soft)"
      : tint === "accent"
        ? "var(--accent-soft)"
        : "var(--ink)";
  const tintFg =
    tint === "success"
      ? "var(--success)"
      : tint === "accent"
        ? "var(--accent)"
        : "var(--bg)";
  return (
    <div className="stat" style={{ padding: 20 }}>
      <div className="flex center between">
        <div className="stat-label">{label}</div>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background: tintBg,
            color: tintFg,
            display: "grid",
            placeItems: "center",
          }}
        >
          <Icon name={icon} size={14} />
        </div>
      </div>
      <div className="stat-val tnum">{formatCurrency(amount)}</div>
      <div className="stat-meta">{meta}</div>
    </div>
  );
}

function EmptyState({ title, sub }: { title: string; sub: string }) {
  return (
    <div style={{ padding: "60px 20px", textAlign: "center" }}>
      <div className="serif" style={{ fontSize: 24, marginBottom: 6 }}>
        {title}
      </div>
      <div className="muted">{sub}</div>
    </div>
  );
}

function PayRow(props: {
  selectable?: boolean;
  selected?: boolean;
  onToggle?: () => void;
  icon: IconName;
  title: string;
  sub: string;
  amount: number;
  status: React.ReactNode;
  leadingAvatar?: {
    _id: string;
    name: string;
    nickname?: string | null;
  };
  action?: React.ReactNode;
}) {
  const {
    selectable,
    selected,
    onToggle,
    icon,
    title,
    sub,
    amount,
    status,
    leadingAvatar,
    action,
  } = props;
  return (
    <div className="row">
      {selectable && (
        <input
          type="checkbox"
          checked={!!selected}
          onChange={onToggle}
          style={{ width: 16, height: 16, accentColor: "var(--ink)" }}
          aria-label="Select for batch payment"
        />
      )}
      {leadingAvatar ? (
        <Avatar user={leadingAvatar} size="sm" />
      ) : (
        <div className="row-icon">
          <Icon name={icon} size={18} />
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="row-title">{title}</div>
        <div className="row-meta">{sub}</div>
        <div style={{ marginTop: 6 }}>{status}</div>
      </div>
      <div className="flex center gap-3">
        <div className="serif tnum" style={{ fontSize: 18 }}>
          {formatCurrency(amount)}
        </div>
        {action}
      </div>
    </div>
  );
}
