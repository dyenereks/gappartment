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
  relTime,
} from "@/lib/utils";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";

// Fixed-decimal formatter for live electrical metrics (handles nulls).
const metricNum = (n: number | null, digits: number) =>
  n === null || n === undefined
    ? "—"
    : n.toLocaleString("en-PH", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      });

function SwitchChip({ label, on }: { label: string; on: boolean }) {
  return (
    <span
      style={{
        fontSize: 11,
        padding: "3px 8px",
        borderRadius: 999,
        border: "1px solid var(--line-soft)",
        background: on ? "var(--success-soft)" : "var(--bg-2)",
        color: on ? "var(--success)" : "var(--ink-faint)",
      }}
    >
      {label}: {on ? "On" : "Off"}
    </span>
  );
}

function EnergyDeviceRow({ d }: { d: Doc<"energyReadings"> }) {
  const cost = d.energyKwh != null ? d.energyKwh * d.ratePerKwh : null;
  const metrics = [
    { label: "Power", value: d.powerW != null ? `${metricNum(d.powerW, 0)} W` : "—" },
    { label: "Voltage", value: d.voltageV != null ? `${metricNum(d.voltageV, 1)} V` : "—" },
    { label: "Current", value: d.currentA != null ? `${metricNum(d.currentA, 2)} A` : "—" },
    { label: "Energy", value: d.energyKwh != null ? `${metricNum(d.energyKwh, 2)} kWh` : "—" },
  ];

  return (
    <div style={{ padding: "14px 0", borderTop: "1px solid var(--line-soft)" }}>
      <div className="flex center between" style={{ gap: 10 }}>
        <div className="flex center gap-2" style={{ minWidth: 0 }}>
          <div
            className="row-icon"
            style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
          >
            <Icon name="bolt" size={16} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div
              className="row-title"
              style={{
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {d.deviceName}
            </div>
            <div className="row-meta">Updated {relTime(d.reportedAt)}</div>
          </div>
        </div>
        <Badge kind={d.online ? "success" : "warning"} dot>
          {d.online ? "Online" : "Offline"}
        </Badge>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(96px, 1fr))",
          gap: 10,
          marginTop: 12,
        }}
      >
        {metrics.map((m) => (
          <div
            key={m.label}
            style={{ background: "var(--bg-2)", borderRadius: 10, padding: "8px 10px" }}
          >
            <div
              className="muted"
              style={{
                fontSize: 10,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              {m.label}
            </div>
            <div className="serif tnum" style={{ fontSize: 16, marginTop: 2 }}>
              {m.value}
            </div>
          </div>
        ))}
      </div>

      {(d.switch1 != null || d.switch2 != null || cost != null) && (
        <div
          className="flex center between"
          style={{ marginTop: 10, gap: 8, flexWrap: "wrap" }}
        >
          <div className="flex center gap-2" style={{ flexWrap: "wrap" }}>
            {d.switch1 != null && <SwitchChip label="Switch 1" on={d.switch1} />}
            {d.switch2 != null && <SwitchChip label="Switch 2" on={d.switch2} />}
          </div>
          {cost != null && (
            <div className="muted" style={{ fontSize: 12 }}>
              ≈ {formatCurrency(cost)} @ {formatCurrency(d.ratePerKwh)}/kWh
            </div>
          )}
        </div>
      )}
    </div>
  );
}

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
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<{ ok: boolean; text: string } | null>(
    null
  );

  const me = useQuery(api.users.current);
  const users = useQuery(api.users.list);
  const bills = useQuery(api.bills.listByMonth, { month });
  const expenses = useQuery(api.expenses.listByMonth, { month });
  const leyecoBills = useQuery(api.leyecoBills.list);
  const liveEnergy = useQuery(api.energyReadings.latestPerDevice);

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

  const runSync = async () => {
    setSyncing(true);
    setSyncMsg(null);
    try {
      // Same-origin GET — the route reads our Clerk session to authorize.
      // syncBill fires the admin notification (in-app + push) on a new bill;
      // the leyecoBills list below updates reactively, no refetch needed.
      const res = await fetch("/api/leyeco/sync");
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setSyncMsg({
          ok: false,
          text: data?.message || `Sync failed (${res.status})`,
        });
      } else if (data?.isNew) {
        setSyncMsg({ ok: true, text: "New bill imported — admins notified." });
      } else {
        setSyncMsg({
          ok: true,
          text: data?.message || "Already up to date.",
        });
      }
    } catch {
      setSyncMsg({ ok: false, text: "Couldn't reach the sync endpoint." });
    } finally {
      setSyncing(false);
    }
  };

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

          {/* Live energy */}
          <div className="card card-lg" style={{ marginTop: 24 }}>
            <div className="card-head">
              <div>
                <h2 className="card-title">Live energy</h2>
                <div className="card-sub">
                  {liveEnergy && liveEnergy.length > 0
                    ? `${liveEnergy.length} device${liveEnergy.length === 1 ? "" : "s"} reporting`
                    : "Pushed from local smart plugs"}
                </div>
              </div>
              {liveEnergy && liveEnergy.length > 0 && (
                <div style={{ textAlign: "right" }}>
                  <div className="serif tnum" style={{ fontSize: 20 }}>
                    {metricNum(
                      liveEnergy.reduce(
                        (s, d) => s + (d.online && d.powerW != null ? d.powerW : 0),
                        0
                      ),
                      0
                    )}{" "}
                    W
                  </div>
                  <div className="muted" style={{ fontSize: 11 }}>
                    drawing now
                  </div>
                </div>
              )}
            </div>
            {liveEnergy === undefined ? (
              <div className="muted" style={{ padding: "24px 0", textAlign: "center" }}>
                Loading…
              </div>
            ) : liveEnergy.length === 0 ? (
              <div className="muted" style={{ padding: "24px 0", textAlign: "center" }}>
                No energy readings yet. Point your device at POST
                /api/energy/ingest.
              </div>
            ) : (
              liveEnergy.map((d) => <EnergyDeviceRow key={d.deviceId} d={d} />)
            )}
          </div>

          {/* Leyeco electric bills */}
          <div className="card card-lg" style={{ marginTop: 24 }}>
            <div className="card-head">
              <div>
                <h2 className="card-title">Leyeco Electric Bills</h2>
                <div className="card-sub">
                  Synced from Leyeco2 · admins are notified when a new bill lands
                </div>
              </div>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={runSync}
                disabled={syncing}
              >
                <Icon name="refresh" size={14} />
                {syncing ? "Syncing…" : "Sync now"}
              </button>
            </div>
            {syncMsg && (
              <div
                style={{
                  fontSize: 13,
                  padding: "8px 12px",
                  borderRadius: 10,
                  marginBottom: 12,
                  background: syncMsg.ok
                    ? "var(--success-soft)"
                    : "var(--danger-soft)",
                  color: syncMsg.ok ? "var(--success)" : "var(--danger)",
                }}
              >
                {syncMsg.text}
              </div>
            )}
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
