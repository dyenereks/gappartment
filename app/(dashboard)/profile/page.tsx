"use client";
import { useEffect, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import Image from "next/image";
import Link from "next/link";
import PageHead from "@/components/PageHead";
import Avatar from "@/components/Avatar";
import Badge from "@/components/Badge";
import Icon from "@/components/Icon";
import PaymentMethodModal from "@/components/PaymentMethodModal";
import PushToggle from "@/components/PushToggle";
import { displayName, formatLongDate } from "@/lib/utils";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

interface PaymentMethod {
  _id: Id<"paymentMethods">;
  provider: string;
  accountNumber?: string | null;
  qrCodeUrl?: string | null;
}

export default function ProfilePage() {
  const profile = useQuery(api.users.current);
  const methods = useQuery(api.paymentMethods.mine);
  const updateProfile = useMutation(api.users.updateProfile);

  const [editing, setEditing] = useState(false);
  const [nickname, setNickname] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [methodModal, setMethodModal] = useState<{
    open: boolean;
    method: PaymentMethod | null;
  }>({ open: false, method: null });

  useEffect(() => {
    if (profile) setNickname(profile.nickname ?? "");
  }, [profile]);

  const handleSave = async () => {
    setError("");
    setSaving(true);
    try {
      await updateProfile({ nickname: nickname.trim() || null });
      setEditing(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (!profile) {
    return (
      <div>
        <PageHead
          eyebrow="Account"
          title={`Your <em>profile</em>`}
          sub="Personal details, payment methods, and preferences."
        />
        <div className="card card-lg" style={{ minHeight: 280 }} aria-hidden />
      </div>
    );
  }

  return (
    <div>
      <PageHead
        eyebrow="Account"
        title={`Your <em>profile</em>`}
        sub="Personal details, payment methods, and preferences."
      />

      <div className="cols-1-2">
        {/* Identity card */}
        <div className="card card-lg" style={{ textAlign: "center", padding: 32 }}>
          {profile.imageUrl ? (
            <span
              aria-hidden
              className="avatar avatar-xl"
              style={{
                margin: "0 auto",
                background: `center/cover url(${profile.imageUrl})`,
                color: "transparent",
              }}
            />
          ) : (
            <div style={{ display: "grid", placeItems: "center" }}>
              <Avatar user={profile} size="xl" />
            </div>
          )}
          <div
            className="serif"
            style={{ fontSize: 28, letterSpacing: "-0.01em", marginTop: 16 }}
          >
            {displayName(profile)}
          </div>
          <div
            className="flex center gap-2"
            style={{
              justifyContent: "center",
              marginTop: 6,
              flexWrap: "wrap",
            }}
          >
            <Badge kind="ink">{profile.isAdmin ? "Admin" : "Tenant"}</Badge>
            <Badge dot>Joined {formatLongDate(profile._creationTime)}</Badge>
          </div>
          <div className="muted" style={{ marginTop: 12, fontSize: 13 }}>
            {profile.email}
          </div>

          {saved && (
            <div
              style={{
                marginTop: 16,
                padding: "8px 12px",
                background: "var(--success-soft)",
                color: "var(--success)",
                borderRadius: 10,
                fontSize: 13,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Icon name="check" size={14} /> Saved
            </div>
          )}
        </div>

        {/* Details, payment methods */}
        <div>
          <div className="card card-lg">
            <div className="card-head">
              <h2 className="card-title">Personal details</h2>
              {editing ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      setEditing(false);
                      setNickname(profile.nickname ?? "");
                      setError("");
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={handleSave}
                    disabled={saving}
                  >
                    <Icon name="check" size={14} />{" "}
                    {saving ? "Saving…" : "Save"}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => setEditing(true)}
                >
                  <Icon name="edit" size={14} /> Edit nickname
                </button>
              )}
            </div>
            <div
              className="grid gap-3"
              style={{ gridTemplateColumns: "1fr 1fr" }}
            >
              <div className="field">
                <label className="field-label">Full name</label>
                <div style={{ padding: "10px 0", fontWeight: 500 }}>
                  {profile.name}
                </div>
              </div>
              <div className="field">
                <label className="field-label">Nickname</label>
                {editing ? (
                  <input
                    className="input"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder="Pick a nickname"
                    maxLength={30}
                  />
                ) : (
                  <div
                    style={{
                      padding: "10px 0",
                      fontWeight: 500,
                      color: profile.nickname
                        ? "var(--ink)"
                        : "var(--ink-faint)",
                    }}
                  >
                    {profile.nickname || "—"}
                  </div>
                )}
              </div>
              <div className="field">
                <label className="field-label">Email</label>
                <div style={{ padding: "10px 0", fontWeight: 500 }}>
                  {profile.email}
                </div>
              </div>
              <div className="field">
                <label className="field-label">Role</label>
                <div style={{ padding: "10px 0", fontWeight: 500 }}>
                  {profile.isAdmin ? "Admin" : "Tenant"}
                </div>
              </div>
            </div>
            {error && (
              <div
                style={{
                  marginTop: 12,
                  color: "var(--danger)",
                  fontSize: 13,
                  padding: 10,
                  background: "var(--danger-soft)",
                  borderRadius: 10,
                }}
              >
                {error}
              </div>
            )}
          </div>

          <div className="card card-lg" style={{ marginTop: 16 }}>
            <div className="card-head">
              <h2 className="card-title">Notifications</h2>
            </div>
            <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
              Get a push notification when a new bill is added or someone
              sends you a payment. Works in Chrome, Edge, Firefox, and
              iOS Safari (when installed as a home-screen app).
            </p>
            <PushToggle />
          </div>

          {profile.isAdmin && (
            <Link
              href="/admin"
              className="card card-lg"
              style={{
                marginTop: 16,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px 20px",
                textDecoration: "none",
                color: "var(--ink)",
              }}
            >
              <div className="flex center gap-3">
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: "var(--accent-soft)",
                    color: "var(--accent)",
                    display: "grid",
                    placeItems: "center",
                    flexShrink: 0,
                  }}
                >
                  <Icon name="admin" size={18} />
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>Admin Panel</div>
                  <div className="muted" style={{ fontSize: 12 }}>Manage tenants, bills, and balances</div>
                </div>
              </div>
              <Icon name="chevron-right" size={16} />
            </Link>
          )}

          <div className="card card-lg" style={{ marginTop: 16 }}>
            <div className="card-head">
              <h2 className="card-title">Payment methods</h2>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setMethodModal({ open: true, method: null })}
              >
                <Icon name="plus" size={14} /> Add method
              </button>
            </div>
            <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
              Add one or more accounts (GCash, Maya, BDO, or any other bank /
              e-wallet) so tenants can pay you. Each method needs a name and at
              least an account number or a QR code.
            </p>

            {methods === undefined ? (
              <div className="muted" style={{ padding: 24 }}>
                Loading…
              </div>
            ) : methods.length === 0 ? (
              <div
                style={{
                  padding: 32,
                  textAlign: "center",
                  border: "1px dashed var(--line)",
                  borderRadius: 12,
                  color: "var(--ink-faint)",
                }}
              >
                <Icon name="wallet" size={28} />
                <div style={{ marginTop: 8 }}>
                  No payment methods yet — add one so others can pay you.
                </div>
              </div>
            ) : (
              methods.map((m) => (
                <button
                  type="button"
                  key={m._id}
                  onClick={() =>
                    setMethodModal({ open: true, method: m })
                  }
                  className="row"
                  style={{
                    width: "100%",
                    textAlign: "left",
                    border: "1px solid var(--line)",
                    borderRadius: 12,
                    padding: 12,
                    marginBottom: 10,
                    background: "var(--paper-2)",
                  }}
                >
                  {m.qrCodeUrl ? (
                    <Image
                      src={m.qrCodeUrl}
                      alt={`${m.provider} QR`}
                      width={48}
                      height={48}
                      className="row-icon"
                      style={{ objectFit: "cover" }}
                    />
                  ) : (
                    <div
                      className="row-icon"
                      style={{
                        background: "var(--accent-soft)",
                        color: "var(--accent)",
                      }}
                    >
                      <Icon name="wallet" size={18} />
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="row-title">{m.provider}</div>
                    <div className="row-meta tnum">
                      {m.accountNumber ? m.accountNumber : "QR only"}
                    </div>
                  </div>
                  <Icon name="chevron-right" size={14} />
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      <PaymentMethodModal
        open={methodModal.open}
        onClose={() => setMethodModal({ open: false, method: null })}
        method={methodModal.method}
      />
    </div>
  );
}
