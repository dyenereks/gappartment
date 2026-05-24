"use client";
import { useState } from "react";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import PageHead from "@/components/PageHead";
import MonthPicker from "@/components/MonthPicker";
import Avatar from "@/components/Avatar";
import Icon from "@/components/Icon";
import AddExpenseModal from "@/components/AddExpenseModal";
import EditExpenseModal from "@/components/EditExpenseModal";
import {
  displayName,
  formatCurrency,
  formatLongDate,
  formatMonth,
  getCurrentMonth,
} from "@/lib/utils";
import { api } from "@/convex/_generated/api";

type ExpenseDoc = FunctionReturnType<typeof api.expenses.listByMonth>[number];

export default function ExpensesPage() {
  const [month, setMonth] = useState(getCurrentMonth());
  const [addOpen, setAddOpen] = useState(false);
  const [editExpense, setEditExpense] = useState<ExpenseDoc | null>(null);

  const me = useQuery(api.users.current);
  const users = useQuery(api.users.list);
  const expenses = useQuery(api.expenses.listByMonth, { month });

  const loading =
    me === undefined || users === undefined || expenses === undefined;
  const isAdmin = me?.isAdmin ?? false;
  const myId = me?._id;

  const total = (expenses ?? []).reduce((s, e) => s + e.amount, 0);
  const perPerson = users?.length ? total / users.length : 0;

  return (
    <div>
      <PageHead
        eyebrow={formatMonth(month)}
        title={`Shared <em>expenses</em>`}
        sub="Random purchases that get split between everyone."
        action={
          <>
            <MonthPicker value={month} onChange={setMonth} />
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setAddOpen(true)}
            >
              <Icon name="plus" size={16} /> Add expense
            </button>
          </>
        }
      />

      <div className="cols-2">
        <div className="card card-lg">
          <div className="card-head">
            <div>
              <div
                className="muted"
                style={{
                  fontSize: 11,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                Total this month
              </div>
              <div
                className="serif tnum"
                style={{ fontSize: 48, lineHeight: 1, marginTop: 8 }}
              >
                {formatCurrency(total)}
              </div>
              <div className="muted" style={{ marginTop: 8 }}>
                {expenses?.length ?? 0} expense
                {(expenses?.length ?? 0) === 1 ? "" : "s"} ·{" "}
                {formatCurrency(perPerson)} per person on average
              </div>
            </div>
          </div>
        </div>

        <div className="card card-lg">
          <div className="card-head">
            <h2 className="card-title">By roommate</h2>
          </div>
          {(users ?? []).map((u) => {
            const paid = (expenses ?? [])
              .filter((e) => e.addedBy?._id === u._id)
              .reduce((s, e) => s + e.amount, 0);
            const owedShare = (expenses ?? [])
              .flatMap((e) => e.shares.filter((s) => s.user?._id === u._id))
              .reduce((s, x) => s + x.amount, 0);
            const net = paid - owedShare;
            return (
              <div
                key={u._id}
                className="flex center between"
                style={{
                  padding: "12px 0",
                  borderBottom: "1px solid var(--line-soft)",
                }}
              >
                <div className="flex center gap-3">
                  <Avatar user={u} size="sm" />
                  <div style={{ fontSize: 13 }}>{displayName(u).split(" ")[0]}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div
                    className="tnum"
                    style={{ fontSize: 13, fontWeight: 500 }}
                  >
                    {formatCurrency(paid)}
                  </div>
                  <div
                    className="tnum"
                    style={{
                      fontSize: 11,
                      color:
                        net > 0
                          ? "var(--success)"
                          : net < 0
                            ? "var(--danger)"
                            : "var(--ink-faint)",
                    }}
                  >
                    {net > 0 ? "+" : ""}
                    {formatCurrency(net)} net
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card card-lg" style={{ marginTop: 24 }}>
        <div className="card-head">
          <h2 className="card-title">Recent expenses</h2>
        </div>
        {loading ? (
          <div className="muted" style={{ padding: 24 }}>
            Loading…
          </div>
        ) : expenses!.length === 0 ? (
          <div style={{ padding: "60px 20px", textAlign: "center" }}>
            <div className="serif" style={{ fontSize: 24, marginBottom: 6 }}>
              Nothing yet.
            </div>
            <div className="muted">
              Tap “Add expense” to log a shared purchase.
            </div>
          </div>
        ) : (
          expenses!.map((e) => {
            const payer = e.addedBy;
            return (
              <div
                key={e._id}
                className="row"
                style={{ padding: "14px 4px" }}
              >
                <div className="row-icon">
                  <Icon name="tag" size={18} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="row-title">{e.title}</div>
                  <div className="row-meta">
                    {formatLongDate(e._creationTime)} · Split{" "}
                    {e.shares.length} way{e.shares.length === 1 ? "" : "s"}
                    {e.description ? ` · ${e.description}` : ""}
                  </div>
                </div>
                <div className="flex center gap-3">
                  {payer && <Avatar user={payer} size="sm" />}
                  <div style={{ textAlign: "right" }}>
                    <div
                      className="serif tnum"
                      style={{ fontSize: 18 }}
                    >
                      {formatCurrency(e.amount)}
                    </div>
                    <div className="muted" style={{ fontSize: 11 }}>
                      {formatCurrency(
                        e.shares.length
                          ? e.amount / e.shares.length
                          : 0
                      )}{" "}
                      each
                    </div>
                  </div>
                  {isAdmin && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-icon"
                      onClick={() => setEditExpense(e)}
                      aria-label="Edit expense"
                      title="Edit expense"
                    >
                      <Icon name="edit" size={14} />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <AddExpenseModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        users={users ?? []}
        currentUserId={myId}
        defaultMonth={month}
      />
      <EditExpenseModal
        open={!!editExpense}
        onClose={() => setEditExpense(null)}
        expense={editExpense}
        currentUserId={myId}
      />
    </div>
  );
}
