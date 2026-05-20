"use client";
import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import Image from "next/image";
import { Upload, QrCode, CheckCircle, User, AtSign } from "lucide-react";
import { useUploadThing } from "@/lib/uploadthing";

interface UserProfile {
  id: string;
  name: string;
  nickname?: string | null;
  email: string;
  imageUrl?: string | null;
  isAdmin: boolean;
  qrCodeUrl?: string | null;
}

export default function ProfilePage() {
  const { user: clerkUser } = useUser();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [qrFile, setQrFile] = useState<File | null>(null);
  const [qrPreview, setQrPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [nickname, setNickname] = useState("");
  const [nicknameSaving, setNicknameSaving] = useState(false);
  const [nicknameSaved, setNicknameSaved] = useState(false);
  const [nicknameError, setNicknameError] = useState("");

  const { startUpload, isUploading } = useUploadThing("qrCode");

  useEffect(() => {
    const fetchProfile = async () => {
      const res = await fetch("/api/users");
      const users = await res.json();
      const me = users.find((u: UserProfile) => u.id === clerkUser?.id);
      if (me) {
        setProfile(me);
        setNickname(me.nickname ?? "");
      }
    };
    if (clerkUser?.id) fetchProfile();
  }, [clerkUser?.id]);

  const handleQrChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setQrFile(file);
    const reader = new FileReader();
    reader.onload = () => setQrPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSaveNickname = async () => {
    setNicknameError("");
    setNicknameSaving(true);
    try {
      const res = await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: nickname.trim() || null }),
      });
      if (!res.ok) throw new Error(await res.text());
      const updated = await res.json();
      setProfile((prev) => prev ? { ...prev, nickname: updated.nickname } : prev);
      setNicknameSaved(true);
      setTimeout(() => setNicknameSaved(false), 3000);
    } catch (err: unknown) {
      setNicknameError(err instanceof Error ? err.message : "Failed to save nickname");
    } finally {
      setNicknameSaving(false);
    }
  };

  const handleSaveQr = async () => {
    if (!qrFile) return;
    setError("");
    setSaving(true);

    try {
      const uploaded = await startUpload([qrFile]);
      if (!uploaded?.[0]?.url) throw new Error("Upload failed");

      const res = await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qrCodeUrl: uploaded[0].url }),
      });

      if (!res.ok) throw new Error(await res.text());
      const updated = await res.json();
      setProfile((prev) => prev ? { ...prev, qrCodeUrl: updated.qrCodeUrl } : prev);
      setQrFile(null);
      setQrPreview(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save QR code");
    } finally {
      setSaving(false);
    }
  };

  if (!profile) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-2xl p-5 animate-pulse h-20 border border-cream-300" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold text-brown-600">My Profile</h1>

      {/* User info */}
      <div className="bg-white rounded-2xl p-6 border border-cream-300 shadow-sm">
        <div className="flex items-center gap-4">
          {profile.imageUrl ? (
            <Image
              src={profile.imageUrl}
              alt={profile.name}
              width={64}
              height={64}
              className="w-16 h-16 rounded-full object-cover"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-brown-400 flex items-center justify-center">
              <User size={28} className="text-white" />
            </div>
          )}
          <div>
            <div className="font-semibold text-charcoal-500 text-lg">{profile.name}</div>
            <div className="text-sm text-charcoal-300">{profile.email}</div>
            {profile.isAdmin && (
              <span className="mt-1 inline-block text-xs bg-brown-100 text-brown-600 px-2.5 py-0.5 rounded-full font-medium">
                Admin
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Nickname section */}
      <div className="bg-white rounded-2xl p-6 border border-cream-300 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <AtSign size={20} className="text-brown-500" />
          <h2 className="font-semibold text-charcoal-500">Display Nickname</h2>
        </div>
        <p className="text-sm text-charcoal-300 mb-4">
          Set a short nickname to use instead of your full name across the app.
        </p>
        <input
          type="text"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder={profile.name}
          maxLength={30}
          className="w-full px-3 py-2.5 border border-cream-400 rounded-xl text-sm focus:outline-none focus:border-brown-500 bg-white"
        />
        {nicknameError && (
          <div className="mt-2 text-sm text-red-600">{nicknameError}</div>
        )}
        {nicknameSaved && (
          <div className="mt-2 text-sm text-green-600 flex items-center gap-1.5">
            <CheckCircle size={14} /> Nickname saved!
          </div>
        )}
        <button
          onClick={handleSaveNickname}
          disabled={nicknameSaving}
          className="mt-3 w-full py-2.5 bg-brown-600 text-white rounded-xl text-sm font-medium hover:bg-brown-500 transition-colors disabled:opacity-60"
        >
          {nicknameSaving ? "Saving..." : "Save Nickname"}
        </button>
      </div>

      {/* QR Code section */}
      <div className="bg-white rounded-2xl p-6 border border-cream-300 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <QrCode size={20} className="text-brown-500" />
          <h2 className="font-semibold text-charcoal-500">Payment QR Code</h2>
        </div>
        <p className="text-sm text-charcoal-300 mb-4">
          Upload your e-wallet (GCash, Maya) or bank QR code so other tenants can pay you easily.
        </p>

        {/* Current QR */}
        {profile.qrCodeUrl && !qrPreview && (
          <div className="mb-4">
            <p className="text-xs text-charcoal-200 mb-2 font-medium">Current QR Code</p>
            <div className="inline-block border-2 border-cream-400 rounded-2xl p-3 bg-cream-50">
              <Image
                src={profile.qrCodeUrl}
                alt="Payment QR"
                width={180}
                height={180}
                className="rounded-xl"
              />
            </div>
          </div>
        )}

        {/* Upload new QR */}
        <label className="block cursor-pointer">
          <input
            type="file"
            accept="image/*"
            onChange={handleQrChange}
            className="hidden"
          />
          {qrPreview ? (
            <div className="relative rounded-xl overflow-hidden border-2 border-brown-400 inline-block">
              <Image
                src={qrPreview}
                alt="QR preview"
                width={200}
                height={200}
                className="rounded-xl"
              />
              <div className="absolute bottom-2 right-2 bg-white rounded-lg px-2 py-1 text-xs text-charcoal-400 shadow">
                Tap to change
              </div>
            </div>
          ) : (
            <div className="border-2 border-dashed border-cream-400 rounded-xl p-8 text-center hover:border-brown-400 hover:bg-cream-100 transition-colors">
              <Upload size={24} className="mx-auto text-charcoal-200 mb-2" />
              <p className="text-sm text-charcoal-300 font-medium">
                {profile.qrCodeUrl ? "Upload new QR code" : "Upload QR code"}
              </p>
              <p className="text-xs text-charcoal-200 mt-1">PNG, JPG up to 4MB</p>
            </div>
          )}
        </label>

        {error && (
          <div className="mt-3 bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl border border-red-200">
            {error}
          </div>
        )}

        {saved && (
          <div className="mt-3 bg-green-50 text-green-600 text-sm px-4 py-3 rounded-xl border border-green-200 flex items-center gap-2">
            <CheckCircle size={16} />
            QR code saved successfully!
          </div>
        )}

        {qrFile && (
          <button
            onClick={handleSaveQr}
            disabled={saving || isUploading}
            className="mt-4 w-full py-3 bg-brown-600 text-white rounded-xl text-sm font-medium hover:bg-brown-500 transition-colors disabled:opacity-60"
          >
            {saving || isUploading ? "Saving..." : "Save QR Code"}
          </button>
        )}
      </div>

      {/* Info card */}
      <div className="bg-cream-200 rounded-2xl p-4 border border-cream-400">
        <p className="text-sm text-charcoal-400 font-medium mb-1">How payments work</p>
        <ul className="text-xs text-charcoal-300 space-y-1.5 list-disc list-inside">
          <li>Others scan your QR to send payment via e-wallet or bank</li>
          <li>They upload a screenshot as proof of payment</li>
          <li>You review and confirm receipt to mark them as paid</li>
        </ul>
      </div>
    </div>
  );
}
