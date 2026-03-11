"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

export default function PayReturnPage() {
  const [status, setStatus] = useState<"loading" | "success" | "pending" | "error">("loading");
  const [message, setMessage] = useState("");
  const [manualInvoiceId, setManualInvoiceId] = useState("");
  const [showManualCheck, setShowManualCheck] = useState(false);
  const [payUrl, setPayUrl] = useState("");

  const runCheckPayment = (invoiceId: string) => {
    let retryCount = 0;
    const maxRetries = 120; // ~10 minutes at 5s interval

    const checkPayment = () => {
      fetch(`/api/edahab/confirm-payment?invoiceId=${encodeURIComponent(invoiceId.trim())}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.paid) {
            setStatus("success");
            setMessage(
              data.message ||
              (data.alreadyProcessed
                ? "Payment already confirmed. Membership is pending team approval."
                : "Payment confirmed. Membership is pending team approval.")
            );
            if (typeof window !== "undefined") {
              sessionStorage.removeItem("somali_dreams_ref");
            }
          } else if ((data.status === "Pending" || data.message?.toLowerCase().includes("pending")) && retryCount < maxRetries) {
            retryCount += 1;
            setTimeout(() => checkPayment(), 5000);
          } else if (data.status === "Pending" || data.message?.toLowerCase().includes("pending")) {
            setStatus("pending");
            setMessage("Your payment is still pending. Keep this page open, we will keep checking.");
          } else {
            setStatus("error");
            setMessage(data.error || data.message || "Payment could not be confirmed.");
          }
        })
        .catch(() => {
          setStatus("error");
          setMessage("Something went wrong. Please contact support with your payment details.");
        });
    };

    checkPayment();
  };

  useEffect(() => {
    const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
    const invoiceId =
      params.get("invoiceId") ??
      params.get("InvoiceId") ??
      params.get("invoice_id");
    const payUrlParam = params.get("payUrl") ?? "";
    if (payUrlParam) setPayUrl(payUrlParam);

    if (!invoiceId?.trim()) {
      setStatus("error");
      setMessage("No invoice ID in URL. If you just paid on E-Dahab, copy the Invoice ID from your browser URL (the part after invoiceId=) and enter it below.");
      setShowManualCheck(true);
      return;
    }

    setStatus("loading");
    runCheckPayment(invoiceId);
  }, []);

  return (
    <div className="min-h-screen bg-[#faf8f5] dark:bg-[#0f0f0f]">
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.03] dark:opacity-[0.02]"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)`,
          backgroundSize: "40px 40px",
        }}
      />

      <div className="relative mx-auto max-w-md px-4 py-16 sm:py-24">
        <div className="mb-12 text-center">
          <div className="mb-6 inline-flex items-center justify-center rounded-2xl bg-white dark:bg-white/5 p-4 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.08)] dark:shadow-none ring-1 ring-black/5 dark:ring-white/10">
            <Image
              src="/logo/EF3CA930-92BD-4A4E-8E72-BC823679B82A.webp"
              alt="Somali Dreams"
              width={80}
              height={80}
              className="object-contain"
            />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-[#1a1a1a] dark:text-white sm:text-4xl">
            Somali Dreams
          </h1>
        </div>

        <div className="overflow-hidden rounded-2xl bg-white dark:bg-white/5 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.08),0_8px_48px_-8px_rgba(0,0,0,0.12)] dark:shadow-none ring-1 ring-black/5 dark:ring-white/10">
          <div className="p-8 text-center">
            {payUrl && status !== "success" && (
              <div className="mb-4">
                <a
                  href={payUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600"
                >
                  Open payment page
                </a>
              </div>
            )}
            {status === "loading" && (
              <div className="flex flex-col items-center gap-4">
                <svg
                  className="h-12 w-12 animate-spin text-amber-500"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <p className="text-[#5c5c5c] dark:text-gray-400">
                  Verifying your payment...
                </p>
              </div>
            )}

            {status === "success" && (
              <div className="flex flex-col items-center gap-4">
                <svg
                  className="h-12 w-12 text-emerald-500"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <p className="text-[#5c5c5c] dark:text-gray-400">
                  {message}
                </p>
              </div>
            )}

            {status === "pending" && (
              <div>
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-500/20">
                  <svg
                    className="h-8 w-8 text-amber-600 dark:text-amber-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold text-[#1a1a1a] dark:text-white">
                  Payment in progress
                </h2>
                <p className="mt-2 text-[#5c5c5c] dark:text-gray-400">
                  {message}
                </p>
                <a
                  href="/pay"
                  className="mt-6 inline-block text-sm font-medium text-amber-600 hover:text-amber-700 dark:text-amber-400"
                >
                  Back to payment
                </a>
              </div>
            )}

            {status === "error" && (
              <div>
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-500/20">
                  <svg
                    className="h-8 w-8 text-red-600 dark:text-red-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold text-[#1a1a1a] dark:text-white">
                  Payment issue
                </h2>
                <p className="mt-2 text-[#5c5c5c] dark:text-gray-400">
                  {message}
                </p>
                {showManualCheck && (
                  <div className="mt-6 space-y-3">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Enter your Invoice ID (from the E-Dahab URL after invoiceId=) to verify and complete registration:
                    </p>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (manualInvoiceId.trim()) {
                          setStatus("loading");
                          runCheckPayment(manualInvoiceId.trim());
                        }
                      }}
                      className="flex gap-2"
                    >
                      <input
                        type="text"
                        value={manualInvoiceId}
                        onChange={(e) => setManualInvoiceId(e.target.value)}
                        placeholder="Invoice ID"
                        className="flex-1 rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm dark:border-gray-700 dark:text-white"
                      />
                      <button
                        type="submit"
                        disabled={!manualInvoiceId.trim()}
                        className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
                      >
                        Verify
                      </button>
                    </form>
                  </div>
                )}
                <a
                  href="/pay"
                  className="mt-6 inline-block rounded-xl bg-amber-500 py-3 px-6 font-semibold text-white hover:bg-amber-600"
                >
                  Try again
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
