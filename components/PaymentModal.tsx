"use client";
import { useState } from "react";
import Image from "next/image";
import Modal from "./Modal";
import { formatCurrency } from "@/lib/utils";
import { useUploadThing } from "@/lib/uploadthing";
import { Upload, CheckCircle } from "lucide-react";

interface PaymentModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  shareId: string;
  shareType: "bill" | "expense";
  parentId: string;
  amount: number;
  receiverName: string;
  receiverQrUrl?: string | null;
}

export default function PaymentModal({
  open,
  onClose,
  onSuccess,
  shareId,
  shareType,
  parentId,
  amount,
  receiverName,
  receiverQrUrl,
}: PaymentModalProps) {
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
      const endpoint =
        shareType === "bill"
          ? `/api/bills/${parentId}/shares/${shareId}`
          : `/api/expenses/${parentId}/shares/${shareId}`;

      const res = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "submit_proof", proofUrl }),
      });

      if (!res.ok) throw new Error(await res.text());
      onSuccess();
      onClose();
      resetForm();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setProofFile(null);
    setProofPreview(null);
    setError("");
  };

  return (
    <Modal open={open} onClose={onClose} title="Submit Payment" size="md">
      <div className="p-5 space-y-5">
        {/* Amount */}
        <div className="bg-cream-100 rounded-xl p-4 text-center">
          <div className="text-sm text-charcoal-300 mb-1">Amount to pay</div>
          <div className="text-3xl font-bold text-brown-600">{formatCurrency(amount)}</div>
          <div className="text-sm text-charcoal-300 mt-1">
            to <span className="font-medium text-charcoal-400">{receiverName}</span>
          </div>
        </div>

        {/* Receiver QR */}
        {receiverQrUrl ? (
          <div>
            <p className="text-sm font-medium text-charcoal-400 mb-2 text-center">
              Scan to pay via e-wallet / bank transfer
            </p>
            <div className="flex justify-center">
              <div className="border-2 border-cream-400 rounded-2xl p-3 bg-white inline-block">
                <Image
                  src={receiverQrUrl}
                  alt="Payment QR"
                  width={200}
                  height={200}
                  className="rounded-xl"
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
            <p className="text-sm text-amber-700">
              {receiverName} hasn&apos;t uploaded a payment QR yet. Coordinate directly with them.
            </p>
          </div>
        )}

        {/* Upload proof */}
        <div>
          <label className="block text-sm font-medium text-charcoal-400 mb-2">
            Upload Proof of Payment
          </label>
          <label className="block w-full cursor-pointer">
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
            {proofPreview ? (
              <div className="relative rounded-xl overflow-hidden border-2 border-brown-400">
                <Image
                  src={proofPreview}
                  alt="Proof preview"
                  width={400}
                  height={200}
                  className="w-full object-cover max-h-48"
                />
                <div className="absolute bottom-2 right-2 bg-white rounded-lg px-2 py-1 text-xs text-charcoal-400 shadow">
                  Tap to change
                </div>
              </div>
            ) : (
              <div className="border-2 border-dashed border-cream-400 rounded-xl p-8 text-center hover:border-brown-400 hover:bg-cream-100 transition-colors">
                <Upload size={24} className="mx-auto text-charcoal-200 mb-2" />
                <p className="text-sm text-charcoal-300">
                  Tap to upload screenshot
                </p>
                <p className="text-xs text-charcoal-200 mt-1">JPG, PNG up to 8MB</p>
              </div>
            )}
          </label>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl border border-red-200">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-cream-400 text-charcoal-400 text-sm font-medium hover:bg-cream-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || isUploading || !proofFile}
            className="flex-1 py-3 rounded-xl bg-brown-600 text-white text-sm font-medium hover:bg-brown-500 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading || isUploading ? (
              "Uploading..."
            ) : (
              <>
                <CheckCircle size={16} />
                Submit Payment
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}
