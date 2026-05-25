"use client";
import { useState } from "react";
import { useQuery } from "convex/react";
import PageHead from "@/components/PageHead";
import MonthPicker from "@/components/MonthPicker";
import Avatar from "@/components/Avatar";
import Badge from "@/components/Badge";
import Icon from "@/components/Icon";
import BillRow from "@/components/BillRow";
import {
  displayName,
  formatCurrency,
  formatDate,
  formatMonth,
  getCurrentMonth,
} from "@/lib/utils";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";

function LeyecoBillRow({ bill }: { bill: Doc<"leyecoBills"> }) {
  const [copied, setCopied] = useState(false);

  function copyAmount() {
    navigator.clipboard.writeText(bill.amount.toFixed(2));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="row" style={{ padding: "12px 0", alignItems: "flex-start" }}>
      <div
        className="row-icon"
        style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
      >
        <Icon name="bolt" size={16} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="row-title">{formatMonth(bill.month)}</div>
        <div className="row-meta">
          Bill date {formatDate(bill.billDate)} · Due {formatDate(bill.dueDate)} · {bill.kwhUsed} kWh
        </div>
        <div className="row-meta" style={{ marginTop: 2 }}>
          Bill #{bill.billNumber}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
        <Badge kind={bill.status === "PAID" ? "success" : "warning"}>
          {bill.status}
        </Badge>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span className="serif tnum" style={{ fontSize: 16, fontWeight: 600 }}>
            {formatCurrency(bill.amount)}
          </span>
          <button
            className="btn btn-ghost btn-icon btn-sm"
            onClick={copyAmount}
            title="Copy amount"
            style={{ padding: 4 }}
          >
            <Icon name={copied ? "check" : "copy"} size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [month, setMonth] = useState(getCurrentMonth());

  const me = useQuery(api.users.current);
  const users = useQuery(api.users.list);
  const bills = useQuery(api.bills.listByMonth, { month });
  const expenses = useQuery(api.expenses.listByMonth, { month });
  const leyecoBills = useQuery(api.leyecoBills.list);

  const loading =
    me === undefined ||
    users === undefined ||
    bills === undefined ||
    expenses === undefined ||
    leyecoBills === undefined;

  if (me !== undefined && !me?.isAdmin) {
    return (
      <div>
        <PageHead
          eyebrow="Admin"
          title={`<em>Restricted</em>`}
          sub="Only admins can see this page."
        />
        <div
          className="card card-lg"
          style={{ textAlign: "center", padding: 64 }}
        >
          <Icon name="shield" size={48} />
          <div className="serif" style={{ fontSize: 22, marginTop: 12 }}>
            Admin only.
          </div>
          <div className="muted" style={{ marginTop: 6 }}>
            Ask another admin to promote you in Convex.
          </div>
        </div>
      </div>
    );
  }

  const getUserBalance = (userId: Id<"users">) => {
    const billsOwed = (bills ?? [])
      .filter((b) => b.receiver?._id !== userId)
      .flatMap((b) =>
        b.shares.filter((s) => s.user?._id === userId && !s.isPaid)
      )
      .reduce((sum, s) => sum + s.amount, 0);
    const expOwed = (expenses ?? [])
      .filter((e) => e.addedBy?._id !== userId)
      .flatMap((e) =>
        e.shares.filter((s) => s.user?._id === userId && !s.isPaid)
      )
      .reduce((sum, s) => sum + s.amount, 0);
    const totalOwed = billsOwed + expOwed;

    const billsReceivable = (bills ?? [])
      .filter((b) => b.receiver?._id === userId)
      .flatMap((b) =>
        b.shares.filter((s) => s.user?._id !== userId && !s.isPaid)
      )
      .reduce((sum, s) => sum + s.amount, 0);
    const expReceivable = (expenses ?? [])
      .filter((e) => e.addedBy?._id === userId)
      .flatMap((e) =>
        e.shares.filter((s) => s.user?._id !== userId && !s.isPaid)
      )
      .reduce((sum, s) => sum + s.amount, 0);
    const totalReceivable = billsReceivable + expReceivable;

    return { totalOwed, totalReceivable, net: totalReceivable - totalOwed };
  };

  const totalBillAmount = (bills ?? []).reduce((s, b) => s + b.amount, 0);
  const totalExpenseAmount = (expenses ?? []).reduce(
    (s, e) => s + e.amount,
    0
  );
  const totalCollected = (bills ?? [])
    .flatMap((b) => b.shares.filter((s) => s.isPaid))
    .reduce((s, x) => s + x.amount, 0);
  const totalOutstanding = (bills ?? [])
    .flatMap((b) => b.shares.filter((s) => !s.isPaid))
    .reduce((s, x) => s + x.amount, 0);

  return (
    <div>
      <PageHead
        eyebrow="Admin"
        title={`<em>Manage</em> the house`}
        sub="Only admins can see this. Be kind to your roommates."
        action={
          <>
            <MonthPicker value={month} onChange={setMonth} />
            <Badge kind="ink" dot>
              Admin mode
            </Badge>
          </>
        }
      />

      {loading ? (
        <div className="card card-lg" style={{ minHeight: 240 }} aria-hidden />
      ) : (
        <>
          {/* Stats */}
          <div className="stat-grid">
            <div className="stat" style={{ padding: 18 }}>
              <div className="stat-label">Tenants</div>
              <div className="stat-val tnum">{users!.length}</div>
              <div className="stat-meta">
                {users!.filter((u) => u.isAdmin).length} admin ·{" "}
                {users!.filter((u) => !u.isAdmin).length} member
                {users!.filter((u) => !u.isAdmin).length === 1 ? "" : "s"}
              </div>
            </div>
            <div className="stat" style={{ padding: 18 }}>
              <div className="stat-label">Bills this month</div>
              <div className="stat-val tnum">{bills!.length}</div>
              <div className="stat-meta">
                {bills!.filter((b) => b.shares.every((s) => s.isPaid)).length}{" "}
                fully paid
              </div>
            </div>
            <div className="stat" style={{ padding: 18 }}>
              <div className="stat-label">Collected</div>
              <div className="stat-val tnum">{formatCurrency(totalCollected)}</div>
              <div className="stat-meta">
                of {formatCurrency(totalBillAmount + totalExpenseAmount)} total
              </div>
            </div>
            <div className="stat" style={{ padding: 18 }}>
              <div className="stat-label">Outstanding</div>
              <div
                className="stat-val tnum"
                style={{
                  color:
                    totalOutstanding > 0 ? "var(--danger)" : "var(--success)",
                }}
              >
                {formatCurrency(totalOutstanding)}
              </div>
              <div className="stat-meta">{formatMonth(month)}</div>
            </div>
          </div>

          {/* Leyeco electric bills */}
          <div className="card card-lg" style={{ marginTop: 24 }}>
            <div className="card-head">
              <h2 className="card-title">Leyeco Electric Bills</h2>
              <div className="card-sub">Synced from Leyeco2 · hit /api/leyeco/sync to refresh</div>
            </div>
            {leyecoBills!.length === 0 ? (
              <div className="muted" style={{ padding: "24px 0", textAlign: "center" }}>
                No Leyeco bills imported yet.
              </div>
            ) : (
              leyecoBills!.map((b) => <LeyecoBillRow key={b._id} bill={b} />)
            )}
          </div>

          {/* Tenant balances + bills overview */}
          <div className="cols-2-1" style={{ marginTop: 24 }}>
            <div className="card card-lg">
              <div className="card-head">
                <h2 className="card-title">Tenant balance overview</h2>
              </div>
              {users!.map((u) => {
                const { totalOwed, totalReceivable, net } = getUserBalance(u._id);
                const noPm = u.paymentMethods.length === 0;
                return (
                  <div
                    key={u._id}
                    className="row"
                    style={{ padding: "12px 0", alignItems: "flex-start", gap: 10 }}
                  >
                    <div style={{ flexShrink: 0 }}>
                      <Avatar user={u} size="sm" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        className="flex center gap-2"
                        style={{ flexWrap: "wrap" }}
                      >
                        <span style={{ fontWeight: 500, fontSize: 14 }}>
                          {displayName(u)}
                        </span>
                        {u.isAdmin && <Badge kind="ink">Admin</Badge>}
                        {noPm && (
                          <Badge kind="warning" dot>
                            No payment method
                          </Badge>
                        )}
                      </div>
                      <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                        {u.email}
                      </div>
                      <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
                        owes {formatCurrency(totalOwed)} · owed{" "}
                        {formatCurrency(totalReceivable)}
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div
                        className="serif tnum"
                        style={{
                          fontSize: 18,
                          color:
                            net > 0
                              ? "var(--success)"
                              : net < 0
                                ? "var(--danger)"
                                : "var(--ink-faint)",
                        }}
                      >
                        {net > 0 ? "+" : ""}
                        {formatCurrency(net)}
                      </div>
                      <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>
                        net
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="card card-lg">
              <div className="card-head">
                <h2 className="card-title">Bills breakdown</h2>
              </div>
              {bills!.length === 0 ? (
                <div
                  className="muted"
                  style={{ padding: 24, textAlign: "center" }}
                >
                  No bills for {formatMonth(month)}.
                </div>
              ) : (
                bills!.map((b) => <BillRow key={b._id} bill={b} />)
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
