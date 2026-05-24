import type { ReactNode } from "react";

interface PageHeadProps {
  eyebrow?: string;
  /** Plain text or HTML string. Use `<em>...</em>` for the accent-colored bit. */
  title: string;
  sub?: string;
  action?: ReactNode;
}

export default function PageHead({ eyebrow, title, sub, action }: PageHeadProps) {
  return (
    <div className="page-head">
      <div style={{ minWidth: 0 }}>
        {eyebrow && <div className="page-eyebrow">{eyebrow}</div>}
        <h1
          className="page-title"
          dangerouslySetInnerHTML={{ __html: title }}
        />
        {sub && <div className="page-sub">{sub}</div>}
      </div>
      {action && (
        <div className="flex center gap-3" style={{ flexWrap: "wrap" }}>
          {action}
        </div>
      )}
    </div>
  );
}
