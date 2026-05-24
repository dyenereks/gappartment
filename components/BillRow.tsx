"use client";
import Icon, { type IconName } from "./Icon";
import DueChip from "./DueChip";
import {
  BILL_TYPE_ICON,
  BILL_TYPE_LABELS,
  formatCurrency,
  formatDate,
  formatMonth,
} from "@/lib/utils";

interface BillRowBill {
  _id: string;
  type: string;
  amount: number;
  month: string;
  dueDate?: number | null;
  description?: string | null;
  shares: { isPaid: boolean }[];
}

interface BillRowProps {
  bill: BillRowBill;
  onClick?: () => void;
  /** Optional right-side slot (e.g. inline edit button) */
  right?: React.ReactNode;
}

/**
 * Single-bill row matching the design — icon · label / meta / progress bar
 * stacked, big amount + DueChip on the right. Used in both the dashboard
 * "Upcoming bills" card and the Bills page list.
 */
export default function BillRow({ bill, onClick, right }: BillRowProps) {
  const paidCount = bill.shares.filter((s) => s.isPaid).length;
  const totalCount = bill.shares.length;
  const pct = totalCount === 0 ? 0 : paidCount / totalCount;
  const allPaid = totalCount > 0 && paidCount === totalCount;
  const iconName = (BILL_TYPE_ICON[bill.type] ?? "receipt") as IconName;
  const label = BILL_TYPE_LABELS[bill.type] ?? bill.type;

  const inner = (
    <>
      <div className="row-icon">
        <Icon name={iconName} size={20} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="flex center between gap-3">
          <div className="row-title">{label}</div>
          <div className="serif tnum" style={{ fontSize: 20 }}>
            {formatCurrency(bill.amount)}
          </div>
        </div>
        <div
          className="flex center between gap-3"
          style={{ marginTop: 4, flexWrap: "wrap" }}
        >
          <div className="muted" style={{ fontSize: 13 }}>
            {formatMonth(bill.month)}
            {bill.dueDate ? ` · Due ${formatDate(bill.dueDate)}` : ""}
            {totalCount > 0 ? ` · ${paidCount}/${totalCount} paid` : ""}
          </div>
          <div className="flex center gap-2">
            {right}
            <DueChip date={bill.dueDate ?? null} paid={allPaid} />
          </div>
        </div>
        <div className="bar" style={{ marginTop: 10 }}>
          <span style={{ width: `${pct * 100}%` }} />
        </div>
      </div>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="row"
        style={{
          width: "100%",
          textAlign: "left",
          padding: "14px 16px",
          borderRadius: 12,
          background: "transparent",
        }}
      >
        {inner}
      </button>
    );
  }

  return (
    <div className="row" style={{ padding: "14px 16px" }}>
      {inner}
    </div>
  );
}
