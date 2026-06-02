"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import Icon from "./Icon";
import { relTime } from "@/lib/utils";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

/**
 * Bell + popover combo for the in-app notification inbox. The unread count
 * query is cheap and always runs so the badge stays live even when the panel
 * is closed; the full list query only runs while the panel is open to avoid
 * shipping 30+ rows to every page.
 */
export default function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const unread = useQuery(api.inAppNotifications.unreadCount);
  const list = useQuery(
    api.inAppNotifications.list,
    open ? { limit: 30 } : "skip"
  );
  const markRead = useMutation(api.inAppNotifications.markRead);
  const markAllRead = useMutation(api.inAppNotifications.markAllRead);

  // Close on outside click + Escape, but only while the panel is open so we
  // aren't holding global listeners 24/7.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const handleItemClick = async (
    id: Id<"notifications">,
    url: string | null | undefined,
    isRead: boolean
  ) => {
    if (!isRead) {
      // Fire-and-forget — we don't need to await before navigating.
      void markRead({ id });
    }
    setOpen(false);
    if (url) router.push(url);
  };

  const count = unread ?? 0;

  return (
    <div ref={wrapperRef} style={{ position: "relative" }}>
      <button
        type="button"
        className="bell-btn"
        onClick={() => setOpen((v) => !v)}
        aria-label={
          count > 0 ? `Notifications (${count} unread)` : "Notifications"
        }
        aria-haspopup="true"
        aria-expanded={open}
      >
        <Icon name="bell" size={18} />
        {count > 0 && (
          <span className="bell-badge" aria-hidden>
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>

      {open && (
        <div className="bell-panel" role="dialog" aria-label="Notifications">
          <div className="bell-panel-head">
            <div style={{ fontWeight: 600, fontSize: 14 }}>Notifications</div>
            {count > 0 && (
              <button
                type="button"
                className="bell-mark-all"
                onClick={() => void markAllRead({})}
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="bell-panel-body">
            {list === undefined ? (
              <div className="bell-empty muted">Loading…</div>
            ) : list.length === 0 ? (
              <div className="bell-empty muted">
                You&apos;re all caught up.
              </div>
            ) : (
              list.map((n) => (
                <button
                  key={n._id}
                  type="button"
                  className={"bell-item" + (n.isRead ? "" : " unread")}
                  onClick={() => handleItemClick(n._id, n.url, n.isRead)}
                >
                  <div className="bell-item-dot" aria-hidden />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="bell-item-title">{n.title}</div>
                    <div className="bell-item-body">{n.body}</div>
                    <div className="bell-item-time">
                      {relTime(n._creationTime)}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
