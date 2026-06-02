"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import Icon from "./Icon";
import { relTime } from "@/lib/utils";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

interface PanelPos {
  left: number;
  top?: number;
  bottom?: number;
  width: number;
  maxHeight: number;
}

const PANEL_WIDTH = 360;
const MARGIN = 8;

/**
 * Bell + popover combo for the in-app notification inbox. The unread count
 * query is cheap and always runs so the badge stays live even when the panel
 * is closed; the full list query only runs while the panel is open to avoid
 * shipping 30+ rows to every page.
 *
 * The panel is positioned with `position: fixed`, anchored off the button's
 * bounding rect. This keeps it on-screen in both contexts the bell lives in:
 * the desktop sidebar foot (bottom of a full-height column — opens upward) and
 * the mobile topbar (opens downward). Fixed positioning also sidesteps the
 * sticky topbar's stacking context, which would otherwise trap/clip an
 * absolutely-positioned panel behind page content.
 */
export default function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<PanelPos | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);

  const unread = useQuery(api.inAppNotifications.unreadCount);
  const list = useQuery(
    api.inAppNotifications.list,
    open ? { limit: 30 } : "skip"
  );
  const markRead = useMutation(api.inAppNotifications.markRead);
  const markAllRead = useMutation(api.inAppNotifications.markAllRead);

  // Compute the fixed-position coordinates from the button's rect. Prefer
  // opening downward; flip upward when there isn't enough room below (the
  // desktop sidebar-foot case). Always clamp horizontally to the viewport.
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const btn = btnRef.current;
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const width = Math.min(PANEL_WIDTH, vw - MARGIN * 2);

      // Right-align the panel to the button, then clamp into the viewport.
      let left = rect.right - width;
      left = Math.max(MARGIN, Math.min(left, vw - MARGIN - width));

      const spaceBelow = vh - rect.bottom;
      const spaceAbove = rect.top;
      const openUp = spaceBelow < 280 && spaceAbove > spaceBelow;

      if (openUp) {
        const maxHeight = Math.min(440, spaceAbove - MARGIN * 2);
        setPos({ left, bottom: vh - rect.top + MARGIN, width, maxHeight });
      } else {
        const maxHeight = Math.min(440, spaceBelow - MARGIN * 2);
        setPos({ left, top: rect.bottom + MARGIN, width, maxHeight });
      }
    };
    place();
    window.addEventListener("resize", place);
    // Capture-phase so scrolls inside any container reposition the panel.
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

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
        ref={btnRef}
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

      {open && pos && (
        <div
          className="bell-panel"
          role="dialog"
          aria-label="Notifications"
          style={{
            left: pos.left,
            top: pos.top,
            bottom: pos.bottom,
            width: pos.width,
            maxHeight: pos.maxHeight,
          }}
        >
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
