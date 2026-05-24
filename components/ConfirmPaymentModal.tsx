"use client";
import { useState } from "react";
import Image from "next/image";
import { useMutation } from "convex/react";
import Modal from "./Modal";
import Icon from "./Icon";
import { formatCurrency } from "@/lib/utils";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

type Props =
  | {
      open: boolean;
      onClose: () => void;
      shareId: Id<"billShares">;
      shareType: "bill";
      amount: number;
      payerName: string;
      proofUrl: string;
    }
  | {
      open: boolean;
      onClose: () => void;
      shareId: Id<"expenseShares">;
      shareType: "expense";
      amount: number;
      payerName: string;
      proofUrl: string;
    };

export default function ConfirmPaymentModal(props: Props) {
  const { open, onClose, shareId, shareType, amount, payerName, proofUrl } =
    props;

  const confirmBill = useMutation(api.billShares.confirmPayment);
  const rejectBill = useMutation(api.billShares.rejectPayment);
  const confirmExpense = useMutation(api.expenseShares.confirmPayment);
  const rejectExpense = useMutation(api.expenseShares.rejectPayment);

  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState<"confirm" | "reject" | null>(null);
  const [error, setError] = useState("");

  const run = async (act: "confirm" | "reject") => {
    setLoading(true);
    setAction(act);
    setError("");
    try {
      if (shareType === "bill") {
        if (act === "confirm") await confirmBill({ shareId });
        else await rejectBill({ shareId });
      } else {
        if (act === "confirm") await confirmExpense({ shareId });
        else await rejectExpense({ shareId });
      }
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
      setAction(null);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Review payment"
      footer={
        <>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => run("reject")}
            disabled={loading}
          >
            <Icon name="x-circle" size={14} />
            {loading && action === "reject" ? "Rejecting…" : "Reject"}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => run("confirm")}
            disabled={loading}
          >
            <Icon name="check" size={14} />
            {loading && action === "confirm" ? "Confirming…" : "Confirm received"}
          </button>
        </>
      }
    >
      <div
        style={{
          background: "var(--bg-2)",
          borderRadius: 12,
          padding: 14,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div>
          <div className="muted" style={{ fontSize: 12 }}>
            From
          </div>
          <div style={{ fontWeight: 500 }}>{payerName}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="muted" style={{ fontSize: 12 }}>
            Amount
          </div>
          <div className="serif tnum" style={{ fontSize: 20 }}>
            {formatCurrency(amount)}
          </div>
        </div>
      </div>

      <div>
        <div
          className="muted"
          style={{
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            marginBottom: 8,
          }}
        >
          Proof of payment
        </div>
        <div
          style={{
            borderRadius: 12,
            overflow: "hidden",
            border: "1px solid var(--line)",
            background: "var(--bg-2)",
          }}
        >
          <Image
            src={proofUrl}
            alt="Proof of payment"
            width={400}
            height={300}
            style={{
              width: "100%",
              height: "auto",
              maxHeight: 320,
              objectFit: "contain",
              display: "block",
            }}
          />
        </div>
      </div>

      {error && (
        <div
          style={{
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

      <div className="muted" style={{ fontSize: 13 }}>
        Did you receive this payment from {payerName}?
      </div>
    </Modal>
  );
}
