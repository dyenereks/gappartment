"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SetupProfilePage() {
  const router = useRouter();
  const [nickname, setNickname] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const finish = async (nick: string | null) => {
    setSaving(true);
    setError("");
    try {
      // Ensures user is synced to DB (upsert happens in GET /api/users)
      await fetch("/api/users");

      if (nick) {
        const res = await fetch("/api/users", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nickname: nick }),
        });
        if (!res.ok) throw new Error(await res.text());
      }

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
    <div className="min-h-screen bg-cream-100 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🏠</div>
          <h1 className="text-2xl font-bold text-brown-600">Welcome!</h1>
          <p className="text-charcoal-300 text-sm mt-1">
            Set a nickname so your roommates recognise you easily.
          </p>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-cream-300 shadow-sm">
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-charcoal-400 mb-1.5">
                Nickname <span className="text-charcoal-200">(optional)</span>
              </label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="e.g. Jay, Kim, Roomie"
                maxLength={30}
                autoFocus
                className="w-full px-3 py-2.5 border border-cream-400 rounded-xl text-sm focus:outline-none focus:border-brown-500 bg-white"
              />
              <p className="text-xs text-charcoal-200 mt-1.5">
                This replaces your full name everywhere in the app.
              </p>
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl border border-red-200">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className="w-full py-3 bg-brown-600 text-white rounded-xl text-sm font-medium hover:bg-brown-500 transition-colors disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save & Continue"}
            </button>

            <button
              type="button"
              onClick={() => finish(null)}
              disabled={saving}
              className="w-full py-2.5 text-sm text-charcoal-300 hover:text-charcoal-400 transition-colors disabled:opacity-60"
            >
              Skip for now
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
