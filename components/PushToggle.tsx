"use client";
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import Icon from "./Icon";
import {
  getExistingSubscription,
  isPushConfigured,
  isPushSupported,
  subscribePush,
  unsubscribePush,
} from "@/lib/push";
import { api } from "@/convex/_generated/api";

type Status =
  | { kind: "loading" }
  | { kind: "unsupported"; reason: string }
  | { kind: "denied" }
  | { kind: "off" } // supported, not subscribed
  | { kind: "on"; endpoint: string };

export default function PushToggle() {
  const save = useMutation(api.pushSubscriptions.save);
  const remove = useMutation(api.pushSubscriptions.remove);

  const [status, setStatus] = useState<Status>({ kind: "loading" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Best-effort: discover whether this browser already has a subscription
  // (e.g. user opted in on another visit).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isPushSupported()) {
        if (!cancelled)
          setStatus({
            kind: "unsupported",
            reason: "This browser doesn't support web push (iOS Safari needs PWA install)",
          });
        return;
      }
      if (!isPushConfigured()) {
        if (!cancelled)
          setStatus({
            kind: "unsupported",
            reason: "NEXT_PUBLIC_VAPID_PUBLIC_KEY isn't set — admin must configure web push",
          });
        return;
      }
      if (Notification.permission === "denied") {
        if (!cancelled) setStatus({ kind: "denied" });
        return;
      }
      try {
        const existing = await getExistingSubscription();
        if (cancelled) return;
        if (existing) setStatus({ kind: "on", endpoint: existing.endpoint });
        else setStatus({ kind: "off" });
      } catch {
        if (!cancelled) setStatus({ kind: "off" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Confirms the server still knows about this endpoint. If the user wiped
  // browser data, the local subscription may exist but the server row is
  // gone. We don't act on this — just useful debug info.
  const serverKnows = useQuery(
    api.pushSubscriptions.isSubscribed,
    status.kind === "on" ? { endpoint: status.endpoint } : "skip"
  );

  const enable = async () => {
    setBusy(true);
    setError("");
    try {
      const sub = await subscribePush();
      await save({
        endpoint: sub.endpoint,
        p256dh: sub.p256dh,
        auth: sub.auth,
      });
      setStatus({ kind: "on", endpoint: sub.endpoint });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Couldn't enable");
      if (typeof Notification !== "undefined" && Notification.permission === "denied") {
        setStatus({ kind: "denied" });
      }
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    setError("");
    try {
      const endpoint = await unsubscribePush();
      if (endpoint) await remove({ endpoint });
      setStatus({ kind: "off" });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Couldn't disable");
    } finally {
      setBusy(false);
    }
  };

  const render = () => {
    switch (status.kind) {
      case "loading":
        return (
          <div className="muted" style={{ fontSize: 13 }}>
            Checking…
          </div>
        );
      case "unsupported":
        return (
          <div
            style={{
              fontSize: 13,
              padding: 10,
              background: "var(--warning-soft)",
              color: "oklch(from var(--warning) calc(l - 0.2) c h)",
              borderRadius: 10,
            }}
          >
            {status.reason}
          </div>
        );
      case "denied":
        return (
          <div
            style={{
              fontSize: 13,
              padding: 10,
              background: "var(--danger-soft)",
              color: "var(--danger)",
              borderRadius: 10,
            }}
          >
            Notifications are blocked in your browser settings. Re-enable them
            from the site settings (lock icon in the address bar), then come
            back and click Enable.
          </div>
        );
      case "off":
        return (
          <button
            type="button"
            className="btn btn-primary"
            onClick={enable}
            disabled={busy}
          >
            <Icon name="bell" size={14} />
            {busy ? "Enabling…" : "Enable notifications"}
          </button>
        );
      case "on":
        return (
          <div className="flex center gap-3" style={{ flexWrap: "wrap" }}>
            <div
              className="flex center gap-2"
              style={{
                fontSize: 13,
                padding: "6px 12px",
                background: "var(--success-soft)",
                color: "var(--success)",
                borderRadius: 999,
              }}
            >
              <Icon name="check" size={14} />
              Notifications enabled on this browser
              {serverKnows === false && (
                <span className="muted" style={{ marginLeft: 8 }}>
                  (re-syncing…)
                </span>
              )}
            </div>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={disable}
              disabled={busy}
            >
              {busy ? "Disabling…" : "Disable"}
            </button>
          </div>
        );
    }
  };

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {render()}
      {error && (
        <div
          style={{
            fontSize: 13,
            padding: 10,
            background: "var(--danger-soft)",
            color: "var(--danger)",
            borderRadius: 10,
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
