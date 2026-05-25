"use client";
import { useState } from "react";
import Image from "next/image";
import Icon from "./Icon";
import { downloadImage } from "@/lib/utils";
import type { Id } from "@/convex/_generated/dataModel";

export interface PaymentMethod {
  _id: Id<"paymentMethods">;
  provider: string;
  accountNumber?: string | null;
  qrCodeUrl?: string | null;
}

interface Props {
  method: PaymentMethod;
  receiverName: string;
}

/**
 * Single payment-method card used inside the horizontal carousels in
 * PaymentModal and MultiPaymentModal. The QR is only downloadable here —
 * preview intentionally omitted to keep cards compact.
 */
export default function PaymentMethodCard({ method, receiverName }: Props) {
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [viewingQr, setViewingQr] = useState(false);

  const handleCopy = async () => {
    if (!method.accountNumber) return;
    await navigator.clipboard.writeText(method.accountNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleDownload = async () => {
    if (!method.qrCodeUrl) return;
    setDownloading(true);
    try {
      const safeName = `${receiverName}-${method.provider}-QR`.replace(
        /[^a-zA-Z0-9-_]/g,
        "_"
      );
      await downloadImage(method.qrCodeUrl, `${safeName}.png`);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div
      style={{
        border: "1px solid var(--line)",
        borderRadius: 14,
        padding: 14,
        background: "var(--paper-2)",
        scrollSnapAlign: "center",
        flexShrink: 0,
        width: 260,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div className="flex center gap-2">
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            background: "var(--accent-soft)",
            color: "var(--accent)",
            display: "grid",
            placeItems: "center",
            fontWeight: 600,
            fontSize: 14,
            fontFamily: "var(--font-display)",
          }}
        >
          {method.provider.charAt(0).toUpperCase()}
        </div>
        <div
          style={{
            fontWeight: 500,
            fontSize: 14,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {method.provider}
        </div>
      </div>

      {method.accountNumber && (
        <div>
          <div
            className="muted"
            style={{
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginBottom: 4,
            }}
          >
            Account number
          </div>
          <div
            style={{ background: "var(--bg-2)", borderRadius: 10, padding: 10 }}
          >
            <div
              className="tnum"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 14,
                marginBottom: 8,
                wordBreak: "break-all",
              }}
            >
              {method.accountNumber}
            </div>
            <button
              type="button"
              onClick={handleCopy}
              className="btn btn-outline btn-sm btn-block"
              title="Copy account number"
            >
              {copied ? (
                <>
                  <Icon name="check" size={12} /> Copied
                </>
              ) : (
                <>
                  <Icon name="copy" size={12} /> Copy
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {method.qrCodeUrl && (
        <>
          <button
            type="button"
            onClick={() => setViewingQr(true)}
            className="btn btn-outline btn-block"
          >
            <Icon name="search" size={14} /> View QR
          </button>
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            className="btn btn-outline btn-block"
          >
            <Icon name="download" size={14} />{" "}
            {downloading ? "Saving…" : "Download QR"}
          </button>
        </>
      )}

      {viewingQr && method.qrCodeUrl && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 200,
            background: "oklch(0.1 0.01 60 / 0.92)",
            backdropFilter: "blur(8px)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
          onClick={() => setViewingQr(false)}
        >
          <div
            style={{ width: "100%", maxWidth: 360 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                background: "var(--paper)",
                borderRadius: 20,
                padding: 20,
                display: "flex",
                flexDirection: "column",
                gap: 16,
              }}
            >
              <div className="flex center between">
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>
                    {method.provider} QR code
                  </div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                    {receiverName}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setViewingQr(false)}
                  className="btn btn-ghost btn-sm"
                  aria-label="Close"
                >
                  <Icon name="close" size={16} />
                </button>
              </div>

              <Image
                src={method.qrCodeUrl}
                alt={`${method.provider} QR code`}
                width={320}
                height={320}
                style={{
                  width: "100%",
                  height: "auto",
                  borderRadius: 12,
                  display: "block",
                  border: "1px solid var(--line)",
                }}
              />

              <button
                type="button"
                onClick={handleDownload}
                disabled={downloading}
                className="btn btn-primary btn-block"
              >
                <Icon name="download" size={14} />{" "}
                {downloading ? "Saving…" : "Download QR"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
