"use client";
import { useState } from "react";
import Image from "next/image";
import { useMutation } from "convex/react";
import Modal from "./Modal";
import Icon from "./Icon";
import PaymentMethodCard, { type PaymentMethod } from "./PaymentMethodCard";
import { formatCurrency } from "@/lib/utils";
import { useUploadThing } from "@/lib/uploadthing";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

type Props =
  | {
      open: boolean;
      onClose: () => void;
      shareId: Id<"billShares">;
      shareType: "bill";
      amount: number;
      receiverName: string;
      paymentMethods: PaymentMethod[];
    }
  | {
      open: boolean;
      onClose: () => void;
      shareId: Id<"expenseShares">;
      shareType: "expense";
      amount: number;
      receiverName: string;
      paymentMethods: PaymentMethod[];
    };

export default function PaymentModal(props: Props) {
  const {
    open,
    onClose,
    shareId,
    shareType,
    amount,
    receiverName,
    paymentMethods,
  } = props;

  const submitBillProof = useMutation(api.billShares.submitProof);
  const submitExpenseProof = useMutation(api.expenseShares.submitProof);

  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const { startUpload, isUploading } = useUploadThing("paymentProof");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProofFile(file);
    const reader = new FileReader();
    reader.onload = () => setProofPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!proofFile) {
      setError("Please upload a proof of payment screenshot");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const uploaded = await startUpload([proofFile]);
      if (!uploaded?.[0]?.url) throw new Error("Upload failed");
      const proofUrl = uploaded[0].url;
      if (shareType === "bill") {
        await submitBillProof({ shareId, proofUrl });
      } else {
        await submitExpenseProof({ shareId, proofUrl });
      }
      onClose();
      setProofFile(null);
      setProofPreview(null);
      setError("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const busy = loading || isUploading;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Submit payment"
      footer={
        <>
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
            disabled={busy || !proofFile}
          >
            <Icon name="check" size={14} />
            {busy ? "Uploading…" : "Submit payment"}
          </button>
        </>
      }
    >
      <div
        style={{
          background: "var(--bg-2)",
          borderRadius: 14,
          padding: 16,
          textAlign: "center",
        }}
      >
        <div
          className="muted"
          style={{
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          Amount to pay
        </div>
        <div
          className="serif tnum"
          style={{ fontSize: 40, lineHeight: 1.1, marginTop: 6 }}
        >
          {formatCurrency(amount)}
        </div>
        <div className="muted" style={{ marginTop: 4, fontSize: 13 }}>
          to{" "}
          <span style={{ fontWeight: 500, color: "var(--ink)" }}>
            {receiverName}
          </span>
        </div>
      </div>

      {paymentMethods.length === 0 ? (
        <div
          style={{
            background: "var(--warning-soft)",
            color: "oklch(from var(--warning) calc(l - 0.2) c h)",
            padding: 12,
            borderRadius: 10,
            fontSize: 13,
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
          }}
        >
          <Icon name="wallet" size={16} />
          {receiverName} hasn&apos;t added any payment methods yet. Coordinate
          directly with them.
        </div>
      ) : (
        <div>
          <div className="flex center between" style={{ marginBottom: 8 }}>
            <div className="muted" style={{ fontSize: 13, fontWeight: 500 }}>
              Pay via{" "}
              {paymentMethods.length === 1 ? "this method" : "any of these"}
            </div>
            {paymentMethods.length > 1 && (
              <div className="muted" style={{ fontSize: 11 }}>
                Swipe →
              </div>
            )}
          </div>
          <div
            style={{
              display: "flex",
              gap: 12,
              overflowX: "auto",
              scrollSnapType: "x mandatory",
              padding: "2px 0 8px",
            }}
          >
            {paymentMethods.map((m) => (
              <PaymentMethodCard
                key={m._id}
                method={m}
                receiverName={receiverName}
              />
            ))}
          </div>
        </div>
      )}

      <div className="field">
        <label className="field-label">Upload proof of payment</label>
        <label style={{ cursor: "pointer", display: "block" }}>
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            style={{ display: "none" }}
          />
          {proofPreview ? (
            <div
              style={{
                position: "relative",
                borderRadius: 12,
                overflow: "hidden",
                border: "2px solid var(--accent)",
              }}
            >
              <Image
                src={proofPreview}
                alt="Proof preview"
                width={600}
                height={200}
                style={{
                  width: "100%",
                  height: "auto",
                  maxHeight: 220,
                  objectFit: "cover",
                  display: "block",
                }}
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
                Tap to change
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
              }}
            >
              <Icon name="upload" size={22} />
              <div style={{ fontSize: 13, marginTop: 6 }}>
                Tap to upload screenshot
              </div>
              <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>
                JPG / PNG up to 8MB
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
    </Modal>
  );
}
