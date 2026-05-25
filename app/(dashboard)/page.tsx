"use client";
import { useState } from "react";
import { useQuery } from "convex/react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import PageHead from "@/components/PageHead";
import MonthPicker from "@/components/MonthPicker";
import Badge from "@/components/Badge";
import Ring from "@/components/Ring";
import BillRow from "@/components/BillRow";
import Icon from "@/components/Icon";
import PushToggle from "@/components/PushToggle";
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

export default function DashboardPage() {
  const { user: clerkUser } = useUser();
  const [month, setMonth] = useState(getCurrentMonth());

  const me = useQuery(api.users.current);
  const bills = useQuery(api.bills.listByMonth, { month });
  const expenses = useQuery(api.expenses.listByMonth, { month });

  const loading =
    me === undefined || bills === undefined || expenses === undefined;
  const myId = me?._id;

  // Hero card — the current user's own outstanding total this month
  // (sum of their unpaid shares across every bill).
  const monthBills = bills ?? [];
  const unpaidBills = monthBills.filter((b) =>
    b.shares.some((s) => !s.isPaid)
  );
  const totalPayable = monthBills
    .flatMap((b) =>
      b.shares.filter((s) => s.user?._id === myId && !s.isPaid)
    )
    .reduce((sum, s) => sum + s.amount, 0);

  // Upcoming — unpaid, sorted by due date
  const upcoming = (bills ?? [])
    .filter((b) => b.shares.some((s) => !s.isPaid))
    .sort((a, b) => (a.dueDate ?? Infinity) - (b.dueDate ?? Infinity));

  const firstName =
    (me ? displayName(me) : clerkUser?.firstName ?? "there").split(" ")[0];

  return (
    <div>
      <PageHead
        eyebrow={`${formatMonth(month)} · Welcome back`}
        title={`Hi, <em>${firstName}</em>.`}
        sub="Here's where everyone stands this month."
        action={<MonthPicker value={month} onChange={setMonth} />}
      />

      {loading ? (
        <DashboardSkeleton />
      ) : (
        <>
          {/* Hero balance + share progress */}
          <div className="cols-2">
            <div className="balance-hero">
              <div className="flex center between">
                <span className="label">Total bills payable</span>
                {unpaidBills.length > 0 && (
                  <Badge kind="accent" dot>
                    {unpaidBills.length} unpaid
                  </Badge>
                )}
              </div>
              <div className="amount">
                <em>{formatCurrency(totalPayable)}</em>
              </div>
              <div className="sub">
                Across {unpaidBills.length} of {monthBills.length} bill
                {monthBills.length === 1 ? "" : "s"} · {formatMonth(month)}
              </div>

              <div
                style={{
                  marginTop: 24,
                  display: "flex",
                  gap: 10,
                  flexWrap: "wrap",
                }}
              >
                {unpaidBills.map((b) => {
                  const iconName = (BILL_TYPE_ICON[b.type] ?? "receipt") as IconName;
                  return (
                    <Link
                      key={b._id}
                      href="/bills"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "10px 14px",
                        background: "oklch(1 0 0 / 0.08)",
                        borderRadius: 999,
                        color: "var(--bg)",
                        border: "1px solid oklch(1 0 0 / 0.1)",
                      }}
                    >
                      <Icon name={iconName} size={14} />
                      <span style={{ fontSize: 13 }}>
                        {BILL_TYPE_LABELS[b.type] ?? b.type}
                      </span>
                      <span className="serif tnum" style={{ fontSize: 16 }}>
                        {formatCurrency(b.amount)}
                      </span>
                    </Link>
                  );
                })}
                {unpaidBills.length === 0 && (
                  <div className="sub">
                    {monthBills.length === 0
                      ? "No bills logged for this month yet."
                      : "All bills are fully collected this month. "}
                  </div>
                )}
              </div>
            </div>

            {(() => {
              // === Collection progress card ===
              const mine = monthBills.flatMap((b) =>
                b.shares.filter((s) => s.user?._id === myId)
              );
              const mineTotal = mine.reduce((s, x) => s + x.amount, 0);
              const minePaid = mine
                .filter((x) => x.isPaid)
                .reduce((s, x) => s + x.amount, 0);
              const minePct = mineTotal > 0 ? minePaid / mineTotal : 0;

              // Right ring — money owed *to me* this month (bills I receive)
              // and how much of it has actually been received.
              const owedToMe = monthBills
                .filter((b) => b.receiver?._id === myId)
                .flatMap((b) =>
                  b.shares.filter((s) => s.user?._id !== myId)
                );
              const owedTotal = owedToMe.reduce((s, x) => s + x.amount, 0);
              const owedReceived = owedToMe
                .filter((x) => x.isPaid)
                .reduce((s, x) => s + x.amount, 0);
              const owedPct = owedTotal > 0 ? owedReceived / owedTotal : 0;

              return (
                <div className="card card-lg">
                  <div
                    className="muted"
                    style={{
                      fontSize: 11,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                    }}
                  >
                    Collection progress
                  </div>
                  <h2 className="card-title" style={{ marginTop: 8 }}>
                    {minePct === 1
                      ? "Settled up"
                      : `${formatCurrency(mineTotal - minePaid)} to go`}
                  </h2>

                  <div className="ring-pair">
                    <div className="ring-cell">
                      <Ring pct={minePct} size={104} />
                      <div className="ring-cell-label">Your share</div>
                      <div className="ring-cell-meta tnum">
                        {formatCurrency(minePaid)}{" "}
                        <span className="muted">
                          of {formatCurrency(mineTotal)}
                        </span>
                      </div>
                    </div>
                    <div className="ring-cell">
                      <Ring pct={owedPct} size={104} accent />
                      <div className="ring-cell-label">Owed to me received</div>
                      <div className="ring-cell-meta tnum">
                        {formatCurrency(owedReceived)}{" "}
                        <span className="muted">
                          of {formatCurrency(owedTotal)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      height: 1,
                      background: "var(--line-soft)",
                      margin: "16px 0",
                    }}
                  />
                  <div
                    className="muted"
                    style={{ fontSize: 12, marginBottom: 8 }}
                  >
                    By bill
                  </div>
                  {monthBills.length === 0 ? (
                    <div className="muted" style={{ fontSize: 13 }}>
                      No bills logged for this month.
                    </div>
                  ) : (
                    monthBills.map((b) => {
                      const total = b.amount;
                      const paid = b.shares
                        .filter((s) => s.isPaid)
                        .reduce((a, s) => a + s.amount, 0);
                      const pct = total > 0 ? paid / total : 0;
                      return (
                        <div
                          key={b._id}
                          className="flex center between gap-3"
                          style={{ padding: "5px 0" }}
                        >
                          <div style={{ minWidth: 80, fontSize: 13 }}>
                            {BILL_TYPE_LABELS[b.type] ?? b.type}
                          </div>
                          <div className="bar" style={{ flex: 1 }}>
                            <span style={{ width: `${pct * 100}%` }} />
                          </div>
                          <div
                            className="tnum muted"
                            style={{
                              fontSize: 12,
                              minWidth: 50,
                              textAlign: "right",
                            }}
                          >
                            {Math.round(pct * 100)}%
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              );
            })()}
          </div>

          {/* Quick actions */}
          <div className="card card-lg" style={{ marginTop: 24 }}>
            <div className="card-head">
              <h2 className="card-title">Quick actions</h2>
            </div>
            <div style={{ display: "grid", gap: 10 }}>
              <Link href="/payments" className="btn btn-outline btn-block">
                <Icon name="wallet" size={14} /> Pay outstanding shares
              </Link>
              <Link href="/profile" className="btn btn-outline btn-block">
                <Icon name="wallet" size={14} /> Update payment methods
              </Link>
              <PushToggle compact />
              {me?.isAdmin && (
                <Link href="/bills" className="btn btn-primary btn-block">
                  <Icon name="plus" size={14} /> Add a bill
                </Link>
              )}
              <Link href="/expenses" className="btn btn-primary btn-block">
                <Icon name="plus" size={14} /> Add a shared expense
              </Link>
            </div>
          </div>

          {/* Upcoming bills */}
          <div className="card card-lg" style={{ marginTop: 24 }}>
            <div className="card-head">
              <div>
                <h2 className="card-title">Upcoming bills</h2>
                <div className="card-sub">
                  {upcoming.length} bill{upcoming.length === 1 ? "" : "s"} awaiting payment
                </div>
              </div>
              <Link href="/bills" className="btn btn-ghost btn-sm">
                View all <Icon name="arrow-right" size={14} />
              </Link>
            </div>
            {upcoming.length === 0 ? (
              <div
                style={{ padding: "32px 8px", textAlign: "center" }}
                className="muted"
              >
                No outstanding bills — well done.
              </div>
            ) : (
              upcoming.slice(0, 4).map((b) => <BillRow key={b._id} bill={b} />)
            )}
          </div>
        </>
      )}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="cols-2">
      {[1, 2].map((i) => (
        <div
          key={i}
          className="card card-lg"
          style={{ minHeight: 200 }}
          aria-hidden
        />
      ))}
    </div>
  );
}
