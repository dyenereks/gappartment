"use client";
import { useState } from "react";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useUser } from "@clerk/nextjs";
import PageHead from "@/components/PageHead";
import MonthPicker from "@/components/MonthPicker";
import Badge from "@/components/Badge";
import Ring from "@/components/Ring";
import BillRow from "@/components/BillRow";
import Icon from "@/components/Icon";
import AddBillModal from "@/components/AddBillModal";
import EditBillModal from "@/components/EditBillModal";
import MultiPaymentModal, {
  type SelectedShare,
} from "@/components/MultiPaymentModal";
import {
  BILL_TYPE_ICON,
  BILL_TYPE_LABELS,
  displayName,
  formatCurrency,
  formatDate,
  formatMonth,
  getCurrentMonth,
} from "@/lib/utils";
import { api } from "@/convex/_generated/api";
import type { IconName } from "@/components/Icon";
import type { Id, Doc } from "@/convex/_generated/dataModel";

type BillDoc = FunctionReturnType<typeof api.bills.listByMonth>[number];
type PaymentMethod = Doc<"paymentMethods">;
type Filter = "all" | "unpaid" | "paid";

interface Receiver {
  _id: Id<"users">;
  name: string;
  paymentMethods: PaymentMethod[];
}
interface Payable {
  kind: "bill" | "expense";
  shareId: Id<"billShares"> | Id<"expenseShares">;
  label: string;
  icon: IconName;
  amount: number;
  due?: number | null;
  hasProof: boolean;
  receiver: Receiver | null;
}

export default function DashboardPage() {
  const { user: clerkUser } = useUser();
  const [month, setMonth] = useState(getCurrentMonth());
  const [filter, setFilter] = useState<Filter>("all");
  const [payGroup, setPayGroup] = useState<{
    receiverName: string;
    paymentMethods: PaymentMethod[];
    items: SelectedShare[];
  } | null>(null);
  const [addBillOpen, setAddBillOpen] = useState(false);
  const [editBill, setEditBill] = useState<BillDoc | null>(null);

  const me = useQuery(api.users.current);
  const users = useQuery(api.users.list);
  const bills = useQuery(api.bills.listByMonth, { month });
  const expenses = useQuery(api.expenses.listByMonth, { month });

  const loading =
    me === undefined ||
    users === undefined ||
    bills === undefined ||
    expenses === undefined;
  const myId = me?._id;
  const isAdmin = me?.isAdmin ?? false;
  const monthBills = bills ?? [];
  const monthExpenses = expenses ?? [];

  // ===== What the current user still owes (unpaid shares they don't receive)
  const payables: Payable[] = [];
  for (const b of monthBills) {
    if (b.receiver?._id === myId) continue;
    for (const s of b.shares) {
      if (s.user?._id !== myId || s.isPaid) continue;
      payables.push({
        kind: "bill",
        shareId: s._id,
        label: BILL_TYPE_LABELS[b.type] ?? b.type,
        icon: (BILL_TYPE_ICON[b.type] ?? "receipt") as IconName,
        amount: s.amount,
        due: b.dueDate,
        hasProof: !!s.proofUrl,
        receiver: b.receiver
          ? {
              _id: b.receiver._id,
              name: displayName(b.receiver),
              paymentMethods: b.receiver.paymentMethods,
            }
          : null,
      });
    }
  }
  for (const e of monthExpenses) {
    if (e.addedBy?._id === myId) continue;
    for (const s of e.shares) {
      if (s.user?._id !== myId || s.isPaid) continue;
      payables.push({
        kind: "expense",
        shareId: s._id,
        label: e.title,
        icon: "tag",
        amount: s.amount,
        due: null,
        hasProof: !!s.proofUrl,
        receiver: e.addedBy
          ? {
              _id: e.addedBy._id,
              name: displayName(e.addedBy),
              paymentMethods: e.addedBy.paymentMethods,
            }
          : null,
      });
    }
  }
  const totalPayable = payables.reduce((s, p) => s + p.amount, 0);

  // Group items that still need a proof by receiver → one Submit button each.
  const groups = new Map<string, { receiver: Receiver; items: SelectedShare[] }>();
  for (const p of payables) {
    if (p.hasProof || !p.receiver) continue;
    const g = groups.get(p.receiver._id) ?? { receiver: p.receiver, items: [] };
    g.items.push({
      kind: p.kind,
      shareId: p.shareId,
      label: p.label,
      amount: p.amount,
    });
    groups.set(p.receiver._id, g);
  }
  const payGroups = Array.from(groups.values());

  // ===== All bills (folded in from the old Bills page)
  const filteredBills = monthBills.filter((b) => {
    const allPaid = b.shares.length > 0 && b.shares.every((s) => s.isPaid);
    if (filter === "paid" && !allPaid) return false;
    if (filter === "unpaid" && allPaid) return false;
    return true;
  });

  const firstName = (
    me ? displayName(me) : clerkUser?.firstName ?? "there"
  ).split(" ")[0];

  return (
    <div>
      <PageHead
        eyebrow={`${formatMonth(month)} · Welcome back`}
        title={`Hi, <em>${firstName}</em>.`}
        sub={
          isAdmin
            ? "Bills, collection, and what you owe this month."
            : "Everything you owe this month, in one place."
        }
        action={
          <>
            <MonthPicker value={month} onChange={setMonth} />
            {isAdmin && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setAddBillOpen(true)}
              >
                <Icon name="plus" size={16} /> New bill
              </button>
            )}
          </>
        }
      />

      {loading ? (
        <DashboardSkeleton />
      ) : (
        <>
          {/* Payables hero */}
          <div className="balance-hero">
            <div className="flex center between">
              <span className="label">
                {isAdmin ? "Your share payable" : "Total payable"}
              </span>
              {payables.length > 0 && (
                <Badge kind="accent" dot>
                  {payables.length} unpaid
                </Badge>
              )}
            </div>
            <div className="amount">
              <em>{formatCurrency(totalPayable)}</em>
            </div>
            <div className="sub">
              {payables.length === 0
                ? "You're all settled this month."
                : `${payables.length} unpaid item${
                    payables.length === 1 ? "" : "s"
                  } · ${formatMonth(month)}`}
            </div>

            {payables.length > 0 && (
              <div className="payable-breakdown">
                {payables.map((p) => (
                  <div key={`${p.kind}:${p.shareId}`} className="payable-line">
                    <Icon name={p.icon} size={15} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14 }}>{p.label}</div>
                      <div style={{ fontSize: 12, opacity: 0.6 }}>
                        {p.receiver ? `to ${p.receiver.name}` : "no recipient"}
                        {p.due ? ` · due ${formatDate(p.due)}` : ""}
                        {p.hasProof ? " · awaiting confirmation" : ""}
                      </div>
                    </div>
                    <div className="serif tnum" style={{ fontSize: 18 }}>
                      {formatCurrency(p.amount)}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {payGroups.length > 0 && (
              <div
                style={{
                  marginTop: 20,
                  display: "flex",
                  gap: 10,
                  flexWrap: "wrap",
                  position: "relative",
                  zIndex: 1,
                }}
              >
                {payGroups.map((g) => {
                  const groupTotal = g.items.reduce((s, i) => s + i.amount, 0);
                  return (
                    <button
                      key={g.receiver._id}
                      type="button"
                      className="btn btn-lg"
                      style={{ background: "var(--bg)", color: "var(--ink)" }}
                      onClick={() =>
                        setPayGroup({
                          receiverName: g.receiver.name,
                          paymentMethods: g.receiver.paymentMethods,
                          items: g.items,
                        })
                      }
                    >
                      <Icon name="wallet" size={16} />
                      Pay {g.receiver.name.split(" ")[0]} ·{" "}
                      {formatCurrency(groupTotal)}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Admin: collection progress */}
          {isAdmin && (
            <CollectionProgress bills={monthBills} month={month} />
          )}

          {/* All bills */}
          <div className="card card-lg" style={{ marginTop: 24 }}>
            <div className="card-head">
              <div>
                <h2 className="card-title">All bills</h2>
                <div className="card-sub">
                  {monthBills.length} bill
                  {monthBills.length === 1 ? "" : "s"} · {formatMonth(month)}
                </div>
              </div>
              <div className="seg">
                {(
                  [
                    { id: "all", label: "All" },
                    { id: "unpaid", label: "Unpaid" },
                    { id: "paid", label: "Paid" },
                  ] as { id: Filter; label: string }[]
                ).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className={filter === f.id ? "active" : ""}
                    onClick={() => setFilter(f.id)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
            {filteredBills.length === 0 ? (
              <div style={{ padding: "48px 20px", textAlign: "center" }}>
                <div className="serif" style={{ fontSize: 22, marginBottom: 6 }}>
                  {monthBills.length === 0 ? "No bills yet." : "Nothing to show."}
                </div>
                <div className="muted">
                  {monthBills.length === 0
                    ? `No bills logged for ${formatMonth(month)}.`
                    : "Try a different filter."}
                </div>
                {isAdmin && monthBills.length === 0 && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ marginTop: 16 }}
                    onClick={() => setAddBillOpen(true)}
                  >
                    <Icon name="plus" size={16} /> Add the first one
                  </button>
                )}
              </div>
            ) : (
              filteredBills.map((b) => (
                <BillRow
                  key={b._id}
                  bill={b}
                  onClick={isAdmin ? () => setEditBill(b) : undefined}
                  right={
                    isAdmin ? (
                      <button
                        type="button"
                        className="btn btn-ghost btn-icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditBill(b);
                        }}
                        aria-label="Edit bill"
                        title="Edit bill"
                      >
                        <Icon name="edit" size={14} />
                      </button>
                    ) : null
                  }
                />
              ))
            )}
          </div>
        </>
      )}

      {/* Submit payment (per receiver group) */}
      {payGroup && (
        <MultiPaymentModal
          open={true}
          onClose={() => setPayGroup(null)}
          receiverName={payGroup.receiverName}
          paymentMethods={payGroup.paymentMethods}
          items={payGroup.items}
        />
      )}

      <AddBillModal
        open={addBillOpen}
        onClose={() => setAddBillOpen(false)}
        users={users ?? []}
        currentUserId={myId}
        defaultMonth={month}
      />
      <EditBillModal
        open={!!editBill}
        onClose={() => setEditBill(null)}
        bill={editBill}
        users={users ?? []}
        currentUserId={myId}
      />
    </div>
  );
}

/** Admin collection card: overall ring + per-bill collection bars. */
function CollectionProgress({
  bills,
  month,
}: {
  bills: FunctionReturnType<typeof api.bills.listByMonth>;
  month: string;
}) {
  const billed = bills.reduce((s, b) => s + b.amount, 0);
  const collected = bills
    .flatMap((b) => b.shares.filter((s) => s.isPaid))
    .reduce((s, x) => s + x.amount, 0);
  const pct = billed > 0 ? collected / billed : 0;

  return (
    <div className="card card-lg" style={{ marginTop: 24 }}>
      <div className="card-head">
        <div>
          <h2 className="card-title">Collection progress</h2>
          <div className="card-sub">
            {formatCurrency(collected)} collected of {formatCurrency(billed)}{" "}
            billed · {formatMonth(month)}
          </div>
        </div>
        <Ring pct={pct} size={72} accent />
      </div>
      {bills.length === 0 ? (
        <div className="muted" style={{ fontSize: 13 }}>
          No bills logged for this month.
        </div>
      ) : (
        bills.map((b) => {
          const paid = b.shares
            .filter((s) => s.isPaid)
            .reduce((a, s) => a + s.amount, 0);
          const p = b.amount > 0 ? paid / b.amount : 0;
          return (
            <div
              key={b._id}
              className="flex center between gap-3"
              style={{ padding: "6px 0" }}
            >
              <div style={{ minWidth: 90, fontSize: 13 }}>
                {BILL_TYPE_LABELS[b.type] ?? b.type}
              </div>
              <div className="bar" style={{ flex: 1 }}>
                <span style={{ width: `${p * 100}%` }} />
              </div>
              <div
                className="tnum muted"
                style={{ fontSize: 12, minWidth: 44, textAlign: "right" }}
              >
                {Math.round(p * 100)}%
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <>
      <div className="balance-hero" style={{ minHeight: 200 }} aria-hidden />
      <div
        className="card card-lg"
        style={{ minHeight: 160, marginTop: 24 }}
        aria-hidden
      />
    </>
  );
}
