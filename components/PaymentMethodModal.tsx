"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import { useMutation } from "convex/react";
import Modal from "./Modal";
import Icon from "./Icon";
import { useUploadThing } from "@/lib/uploadthing";
import { PAYMENT_PROVIDERS } from "@/lib/utils";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

interface PaymentMethod {
  _id: Id<"paymentMethods">;
  provider: string;
  accountNumber?: string | null;
  qrCodeUrl?: string | null;
}

interface PaymentMethodModalProps {
  open: boolean;
  onClose: () => void;
  /** null = add mode, object = edit mode */
  method: PaymentMethod | null;
}

const CUSTOM = "__custom__";

export default function PaymentMethodModal({
  open,
  onClose,
  method,
}: PaymentMethodModalProps) {
  const add = useMutation(api.paymentMethods.add);
  const update = useMutation(api.paymentMethods.update);
  const remove = useMutation(api.paymentMethods.remove);

  const initialProviderKey = (m: PaymentMethod | null) => {
    if (!m) return PAYMENT_PROVIDERS[0];
    return (PAYMENT_PROVIDERS as readonly string[]).includes(m.provider)
      ? m.provider
      : CUSTOM;
  };

  const [providerKey, setProviderKey] = useState<string>(
    initialProviderKey(method)
  );
  const [customProvider, setCustomProvider] = useState<string>(
    method && initialProviderKey(method) === CUSTOM ? method.provider : ""
  );
  const [accountNumber, setAccountNumber] = useState<string>(
    method?.accountNumber ?? ""
  );
  const [existingQrUrl, setExistingQrUrl] = useState<string | null>(
    method?.qrCodeUrl ?? null
  );
  const [qrFile, setQrFile] = useState<File | null>(null);
  const [qrPreview, setQrPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const { startUpload, isUploading } = useUploadThing("qrCode");

  useEffect(() => {
    if (!open) return;
    const key = initialProviderKey(method);
    setProviderKey(key);
    setCustomProvider(method && key === CUSTOM ? method.provider : "");
    setAccountNumber(method?.accountNumber ?? "");
    setExistingQrUrl(method?.qrCodeUrl ?? null);
    setQrFile(null);
    setQrPreview(null);
    setError("");
    setDeleting(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, method?._id]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setQrFile(file);
    const reader = new FileReader();
    reader.onload = () => setQrPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const provider = providerKey === CUSTOM ? customProvider.trim() : providerKey;
    if (!provider) {
      setError("Bank / e-wallet name is required");
      return;
    }
    const acct = accountNumber.trim() || null;

    let qrUrl: string | null = existingQrUrl;
    if (qrFile) {
      setLoading(true);
      let uploaded;
      try {
        uploaded = await startUpload([qrFile]);
      } catch (err: unknown) {
        setError(
          "QR upload failed: " +
            (err instanceof Error ? err.message : String(err))
        );
        setLoading(false);
        return;
      }
      if (!uploaded?.[0]?.url) {
        setError("QR upload returned no URL");
        setLoading(false);
        return;
      }
      qrUrl = uploaded[0].url;
    }
    if (!acct && !qrUrl) {
      setError("Provide an account number, a QR code, or both");
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      if (method) {
        await update({
          methodId: method._id,
          provider,
          accountNumber: acct,
          qrCodeUrl: qrUrl,
        });
      } else {
        await add({ provider, accountNumber: acct, qrCodeUrl: qrUrl });
      }
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!method) return;
    if (!confirm(`Remove ${method.provider}?`)) return;
    setDeleting(true);
    try {
      await remove({ methodId: method._id });
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete");
      setDeleting(false);
    }
  };

  const title = method ? "Edit payment method" : "Add payment method";
  const showQr = qrPreview ?? existingQrUrl;
  const busy = loading || isUploading || deleting;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          {method && (
            <button
              type="button"
              className="btn btn-outline"
              onClick={handleDelete}
              disabled={busy}
              style={{ marginRight: "auto", color: "var(--danger)", borderColor: "var(--danger-soft)" }}
            >
              <Icon name="trash" size={14} />
              {deleting ? "Removing…" : "Remove"}
            </button>
          )}
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={busy}
          >
            <Icon name="check" size={14} />
            {busy ? "Saving…" : method ? "Save changes" : "Add method"}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} style={{ display: "contents" }}>
        <div className="field">
          <label className="field-label">Bank / e-wallet</label>
          <select
            className="select"
            value={providerKey}
            onChange={(e) => setProviderKey(e.target.value)}
          >
            {PAYMENT_PROVIDERS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
            <option value={CUSTOM}>Other…</option>
          </select>
          {providerKey === CUSTOM && (
            <input
              className="input"
              value={customProvider}
              onChange={(e) => setCustomProvider(e.target.value)}
              placeholder="e.g. BPI, UnionBank, ShopeePay"
              maxLength={40}
              style={{ marginTop: 8 }}
            />
          )}
        </div>

        <div className="field">
          <label className="field-label">
            Account number{" "}
            <span className="muted">(optional if QR is provided)</span>
          </label>
          <input
            className="input tnum"
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value)}
            placeholder="e.g. 0917 123 4567"
          />
        </div>

        <div className="field">
          <label className="field-label">
            QR code{" "}
            <span className="muted">(optional if account number is provided)</span>
          </label>
          <label
            style={{
              cursor: "pointer",
              display: "inline-block",
              alignSelf: "flex-start",
            }}
          >
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              style={{ display: "none" }}
            />
            {showQr ? (
              <div
                style={{
                  position: "relative",
                  borderRadius: 12,
                  overflow: "hidden",
                  border: "2px solid var(--accent)",
                  display: "inline-block",
                }}
              >
                <Image
                  src={showQr}
                  alt="QR"
                  width={180}
                  height={180}
                  style={{ display: "block", borderRadius: 10 }}
                />
                <div
                  style={{
                    position: "absolute",
                    bottom: 8,
                    right: 8,
                    background: "var(--paper)",
                    borderRadius: 8,
                    padding: "2px 8px",
                    fontSize: 11,
                    color: "var(--ink-soft)",
                  }}
                >
                  Tap to {qrPreview || existingQrUrl ? "replace" : "upload"}
                </div>
              </div>
            ) : (
              <div
                style={{
                  border: "1px dashed var(--line)",
                  borderRadius: 12,
                  padding: 28,
                  textAlign: "center",
                  color: "var(--ink-faint)",
                  width: 220,
                }}
              >
                <Icon name="upload" size={22} />
                <div style={{ fontSize: 13, marginTop: 6 }}>Upload QR code</div>
                <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>
                  PNG/JPG up to 4MB
                </div>
              </div>
            )}
          </label>
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
      </form>
    </Modal>
  );
}
