"use client";
import Icon from "./Icon";
import { formatMonth, shiftMonth } from "@/lib/utils";

interface MonthPickerProps {
  value: string; // "YYYY-MM"
  onChange: (next: string) => void;
}

/**
 * Compact ← / month label / → control matching the design's MonthPicker.
 * Value is a "YYYY-MM" string (the format we already use everywhere).
 */
export default function MonthPicker({ value, onChange }: MonthPickerProps) {
  return (
    <div
      className="flex center"
      style={{
        background: "var(--paper)",
        border: "1px solid var(--line)",
        borderRadius: 10,
        padding: 4,
      }}
    >
      <button
        type="button"
        className="btn btn-ghost btn-icon"
        onClick={() => onChange(shiftMonth(value, -1))}
        aria-label="Previous month"
      >
        <Icon name="chevron-left" size={16} />
      </button>
      <span
        className="flex center gap-2"
        style={{ padding: "6px 14px", fontWeight: 500 }}
      >
        <Icon name="calendar" size={14} />
        {formatMonth(value)}
      </span>
      <button
        type="button"
        className="btn btn-ghost btn-icon"
        onClick={() => onChange(shiftMonth(value, 1))}
        aria-label="Next month"
      >
        <Icon name="chevron-right" size={16} />
      </button>
    </div>
  );
}
