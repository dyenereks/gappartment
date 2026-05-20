"use client";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatMonth, getMonthOptions } from "@/lib/utils";

interface MonthSelectorProps {
  value: string;
  onChange: (month: string) => void;
}

export default function MonthSelector({ value, onChange }: MonthSelectorProps) {
  const options = getMonthOptions(12);

  const currentIndex = options.findIndex((o) => o.value === value);

  const goPrev = () => {
    if (currentIndex < options.length - 1) {
      onChange(options[currentIndex + 1].value);
    }
  };

  const goNext = () => {
    if (currentIndex > 0) {
      onChange(options[currentIndex - 1].value);
    }
  };

  return (
    <div className="flex items-center gap-2 bg-white border border-cream-400 rounded-xl px-3 py-2">
      <button
        onClick={goPrev}
        disabled={currentIndex >= options.length - 1}
        className="p-1 rounded-lg hover:bg-cream-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronLeft size={16} className="text-charcoal-400" />
      </button>

      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="text-sm font-medium text-brown-600 bg-transparent border-none outline-none cursor-pointer"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      <button
        onClick={goNext}
        disabled={currentIndex <= 0}
        className="p-1 rounded-lg hover:bg-cream-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronRight size={16} className="text-charcoal-400" />
      </button>
    </div>
  );
}
