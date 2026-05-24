"use client";
import { useState } from "react";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import PageHead from "@/components/PageHead";
import MonthPicker from "@/components/MonthPicker";
import BillRow from "@/components/BillRow";
import Icon from "@/components/Icon";
import AddBillModal from "@/components/AddBillModal";
import EditBillModal from "@/components/EditBillModal";
import { formatMonth, getCurrentMonth } from "@/lib/utils";
import { api } from "@/convex/_generated/api";

type BillDoc = FunctionReturnType<typeof api.bills.listByMonth>[number];
type Filter = "all" | "unpaid" | "paid";

export default function BillsPage() {
  const [month, setMonth] = useState(getCurrentMonth());
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [editBill, setEditBill] = useState<BillDoc | null>(null);

  const me = useQuery(api.users.current);
  const users = useQuery(api.users.list);
  const bills = useQuery(api.bills.listByMonth, { month });

  const loading = me === undefined || users === undefined || bills === undefined;
  const isAdmin = me?.isAdmin ?? false;
  const myId = me?._id;

  const filtered = (bills ?? []).filter((b) => {
    const allPaid = b.shares.length > 0 && b.shares.every((s) => s.isPaid);
    if (filter === "paid" && !allPaid) return false;
    if (filter === "unpaid" && allPaid) return false;
    if (
      query &&
      !b.type.toLowerCase().includes(query.toLowerCase()) &&
      !(b.description?.toLowerCase().includes(query.toLowerCase()) ?? false)
    )
      return false;
    return true;
  });

  return (
    <div>
      <PageHead
        eyebrow="Shared bills"
        title={`All <em>bills</em>`}
        sub="Track collection across every roommate."
        action={
          <>
            <MonthPicker value={month} onChange={setMonth} />
            {isAdmin && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setAddOpen(true)}
              >
                <Icon name="plus" size={16} /> New bill
              </button>
            )}
          </>
        }
      />

      <div className="card card-lg">
        <div
          className="flex center between gap-3"
          style={{ flexWrap: "wrap", marginBottom: 12 }}
        >
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
          <div
            className="flex center"
            style={{ position: "relative", flex: 1, maxWidth: 320 }}
          >
            <Icon
              name="search"
              size={16}
              style={{ position: "absolute", left: 12, color: "var(--ink-faint)" }}
            />
            <input
              className="input"
              placeholder="Search bills…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{ paddingLeft: 36 }}
            />
          </div>
        </div>

        {loading ? (
          <div className="muted" style={{ padding: 24 }}>
            Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: "60px 20px", textAlign: "center" }}>
            <div className="serif" style={{ fontSize: 24, marginBottom: 6 }}>
              Nothing here.
            </div>
            <div className="muted">
              {query
                ? "No bills match your search."
                : bills?.length === 0
                  ? `No bills added for ${formatMonth(month)} yet.`
                  : "Try a different filter."}
            </div>
            {isAdmin && bills?.length === 0 && (
              <button
                type="button"
                className="btn btn-primary"
                style={{ marginTop: 16 }}
                onClick={() => setAddOpen(true)}
              >
                <Icon name="plus" size={16} /> Add the first one
              </button>
            )}
          </div>
        ) : (
          filtered.map((b) => (
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

      <AddBillModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
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
