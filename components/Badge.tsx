import type { ReactNode } from "react";

type BadgeKind =
  | "default"
  | "success"
  | "warning"
  | "danger"
  | "accent"
  | "info"
  | "ink";

interface BadgeProps {
  children: ReactNode;
  kind?: BadgeKind;
  dot?: boolean;
  className?: string;
}

export default function Badge({
  children,
  kind = "default",
  dot = false,
  className = "",
}: BadgeProps) {
  const cls =
    "badge" +
    (kind === "default" ? "" : " badge-" + kind) +
    (dot ? " badge-dot" : "") +
    (className ? " " + className : "");
  return <span className={cls}>{children}</span>;
}
