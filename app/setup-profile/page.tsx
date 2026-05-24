"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useConvexAuth, useMutation } from "convex/react";
import Icon from "@/components/Icon";
import { api } from "@/convex/_generated/api";

export default function SetupProfilePage() {
  const router = useRouter();
  const { isAuthenticated } = useConvexAuth();
  const { user: clerkUser, isLoaded } = useUser();
  const sync = useMutation(api.users.sync);
  const updateProfile = useMutation(api.users.updateProfile);

  const [nickname, setNickname] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !isLoaded || !clerkUser || synced) return;
    const email = clerkUser.emailAddresses[0]?.emailAddress ?? "";
    const name =
      [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") ||
      email;
    sync({ name, email, imageUrl: clerkUser.imageUrl ?? null })
      .then(() => setSynced(true))
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to sync")
      );
  }, [isAuthenticated, isLoaded, clerkUser, sync, synced]);

  const finish = async (nick: string | null) => {
    setSaving(true);
    setError("");
    try {
      if (nick) await updateProfile({ nickname: nick });
      router.push("/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSaving(false);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    finish(nickname.trim() || null);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div style={{ width: "100%", maxWidth: 440 }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div
            className="brand-mark"
            style={{
              margin: "0 auto 12px",
              width: 44,
              height: 44,
              fontSize: 20,
            }}
          >
            G
          </div>
          <h1
            className="serif"
            style={{ fontSize: 28, letterSpacing: "-0.02em" }}
          >
            Welcome.
          </h1>
          <p className="muted" style={{ marginTop: 4 }}>
            Pick a nickname so your roommates recognise you.
          </p>
        </div>

        <div className="card card-lg">
          <form onSubmit={handleSave} style={{ display: "grid", gap: 14 }}>
            <div className="field">
              <label className="field-label">
                Nickname <span className="muted">(optional)</span>
              </label>
              <input
                className="input"
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="e.g. Jay, Kim, Roomie"
                maxLength={30}
                autoFocus
              />
              <div className="muted" style={{ fontSize: 12 }}>
                Replaces your full name everywhere in the app.
              </div>
            </div>

            {error && (
              <div
                style={{
                  color: "var(--danger)",
                  background: "var(--danger-soft)",
                  padding: 10,
                  borderRadius: 10,
                  fontSize: 13,
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving || !synced}
            >
              <Icon name="check" size={14} />
              {saving
                ? "Saving…"
                : !synced
                  ? "Setting up…"
                  : "Save & continue"}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => finish(null)}
              disabled={saving || !synced}
            >
              Skip for now
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
