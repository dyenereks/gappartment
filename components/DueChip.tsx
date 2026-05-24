import Badge from "./Badge";
import { daysUntil } from "@/lib/utils";

interface DueChipProps {
  /** Epoch ms or ISO string. */
  date: number | string | null | undefined;
  paid: boolean;
}

/**
 * Compact pill that shows the bill's payment / due status:
 * Paid · Due today · Due in Nd · Overdue Nd · (nothing if no due date)
 */
export default function DueChip({ date, paid }: DueChipProps) {
  if (paid) {
    return (
      <Badge kind="success" dot>
        Paid
      </Badge>
    );
  }
  if (date === null || date === undefined) {
    return (
      <Badge kind="warning" dot>
        Unpaid
      </Badge>
    );
  }
  const days = daysUntil(date);
  if (days < 0) {
    return (
      <Badge kind="danger" dot>
        Overdue {Math.abs(days)}d
      </Badge>
    );
  }
  if (days === 0) {
    return (
      <Badge kind="warning" dot>
        Due today
      </Badge>
    );
  }
  if (days <= 3) {
    return (
      <Badge kind="warning" dot>
        Due in {days}d
      </Badge>
    );
  }
  return <Badge dot>Due in {days}d</Badge>;
}
