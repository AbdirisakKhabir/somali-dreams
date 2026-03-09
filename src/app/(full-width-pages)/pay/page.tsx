"use client";

import { useState, useEffect, Suspense } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";

const MEMBERS_AREA_URL =
  process.env.NEXT_PUBLIC_MEMBERS_AREA_URL ?? "https://somalidreams.com/members";

type Country = {
  name: string;
  flag: string;
  code: string;
  dial_code: string;
};

const REF_STORAGE_KEY = "somali_dreams_ref";

const REFERRAL_DISCOUNT = 0.2; // 20% off when using referral link

const PLANS = [
  { id: "monthly", label: "Monthly", amount: 1.99, period: "per month", save: "" },
  { id: "yearly", label: "Yearly", amount: 17.99, period: "per year", save: "Save 25%" },
] as const;

function PayPageContent() {
  const searchParams = useSearchParams();
  const refFromUrl = searchParams.get("ref")?.trim() || undefined;
  const [refCode, setRefCode] = useState<string | undefined>(refFromUrl);
  const [step, setStep] = useState<"phone" | "form">("phone");

  // Persist ref from URL and restore from storage (handles refresh, step changes, WhatsApp link)
  useEffect(() => {
    if (refFromUrl) {
      setRefCode(refFromUrl);
      if (typeof window !== "undefined") {
        sessionStorage.setItem(REF_STORAGE_KEY, refFromUrl);
      }
    } else if (typeof window !== "undefined") {
      const stored = sessionStorage.getItem(REF_STORAGE_KEY);
      if (stored) setRefCode(stored);
    }
  }, [refFromUrl]);

  // Use refCode for submit - prefer URL, fallback to stored
  const effectiveRefCode = refFromUrl || refCode;
  const [plan, setPlan] = useState<"monthly" | "yearly">("monthly");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [useDifferentWhatsApp, setUseDifferentWhatsApp] = useState(false);
  const [whatsappCountry, setWhatsappCountry] = useState<Country | null>(null);
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [countries, setCountries] = useState<Country[]>([]);
  const [countriesLoading, setCountriesLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!useDifferentWhatsApp) return;
    setCountriesLoading(true);
    fetch("/api/countries")
      .then((res) => (res.ok ? res.json() : []))
      .then((data: Country[]) => {
        setCountries(data);
        const somalia = data.find((c) => c.code === "SO");
        setWhatsappCountry(somalia || data[0] || null);
      })
      .catch(() => setCountries([]))
      .finally(() => setCountriesLoading(false));
  }, [useDifferentWhatsApp]);

  const handlePhoneSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const clean = phone.replace(/\D/g, "");
    if (!clean.match(/^6\d{7,}$/)) {
      setError("Please enter a valid phone number (6XXXXXXX)");
      return;
    }
    setPhone(clean);
    setStep("form");
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (
      useDifferentWhatsApp &&
      (!whatsappNumber.trim() || !whatsappCountry)
    ) {
      setError("Please enter your WhatsApp number");
      return;
    }
    setLoading(true);
    try {
      const phoneFull = phone.startsWith("252") ? phone : "252" + phone.replace(/\D/g, "");
      const whatsappFull =
        useDifferentWhatsApp && whatsappCountry && whatsappNumber.trim()
          ? whatsappCountry.dial_code.replace(/\D/g, "") + whatsappNumber.replace(/\D/g, "")
          : undefined;

      const selectedPlan = PLANS.find((p) => p.id === plan) ?? PLANS[0];
      // API applies 20% discount when referralCode is valid

      // Create invoice only - member is created when payment succeeds (not on cancel)
      const invoiceRes = await fetch("/api/edahab/create-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          edahabNumber: phone,
          name: name.trim(),
          phone: phoneFull,
          whatsappPhone: whatsappFull,
          referralCode: effectiveRefCode,
          amount: selectedPlan.amount,
          plan: selectedPlan.id,
        }),
      });
      const invoiceData = await invoiceRes.json();

      if (invoiceRes.ok && invoiceData.paymentUrl) {
        window.location.href = invoiceData.paymentUrl;
        return;
      }

      setError(invoiceData.error || "Payment could not be started. Please try again.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const formatPhoneDisplay = (p: string) => {
    if (p.startsWith("252")) return `+252 ${p.slice(3)}`;
    if (p.startsWith("6")) return `252 ${p}`;
    return p;
  };

  return (
    <div className="min-h-screen bg-[#faf8f5] dark:bg-[#0f0f0f]">
      {/* Subtle background pattern */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.03] dark:opacity-[0.02]"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)`,
          backgroundSize: "40px 40px",
        }}
      />

      <div className="relative mx-auto max-w-md px-4 py-16 sm:py-24">
        {/* Header */}
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
          <p className="mt-3 text-base text-[#5c5c5c] dark:text-gray-400">
            Join our community – register and pay securely
          </p>
        </div>

        {/* Step indicator */}
        {!submitted && (
          <div className="mb-8 flex items-center justify-center gap-2">
            <div
              className={`h-2 w-12 rounded-full transition-colors duration-300 ${
                step === "phone" ? "bg-amber-500" : "bg-amber-400/80"
              }`}
            />
            <div
              className={`h-2 w-12 rounded-full transition-colors duration-300 ${
                step === "form" ? "bg-amber-500" : "bg-gray-200 dark:bg-gray-700"
              }`}
            />
          </div>
        )}

        {/* Card */}
        <div className="overflow-hidden rounded-2xl bg-white dark:bg-white/5 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.08),0_8px_48px_-8px_rgba(0,0,0,0.12)] dark:shadow-none ring-1 ring-black/5 dark:ring-white/10">
          <div className="p-4 sm:p-8">
            {submitted ? (
              <div className="py-8 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-500/20">
                  <svg
                    className="h-8 w-8 text-emerald-600 dark:text-emerald-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold text-[#1a1a1a] dark:text-white">
                  You&apos;re all set!
                </h2>
                <p className="mt-2 text-[#5c5c5c] dark:text-gray-400">
                  Complete payment to become a member and receive your referral code via WhatsApp.
                </p>
              </div>
            ) : step === "phone" ? (
              <form onSubmit={handlePhoneSubmit} className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold text-[#1a1a1a] dark:text-white">
                    Enter your phone number
                  </h2>
                  <p className="mt-1 text-sm text-[#5c5c5c] dark:text-gray-400">
                    We&apos;ll use this for payment and registration
                  </p>
                </div>

                {error && (
                  <div className="rounded-xl bg-red-50 dark:bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-400">
                    {error}
                  </div>
                )}

                <div>
                  <label className="mb-2 block text-sm font-medium text-[#1a1a1a] dark:text-white">
                    Phone number
                  </label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) =>
                      setPhone(e.target.value.replace(/\D/g, "").slice(0, 12))
                    }
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3.5 text-base text-[#1a1a1a] placeholder:text-gray-400 transition-colors focus:border-amber-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 dark:border-gray-700 dark:bg-gray-800/50 dark:text-white dark:placeholder:text-gray-500 dark:focus:border-amber-400 dark:focus:bg-gray-800"
                    placeholder="612345678"
                    inputMode="numeric"
                  />
                  <p className="mt-1.5 text-xs text-[#5c5c5c] dark:text-gray-500">
                    Must start with 6 (e.g. 612345678)
                  </p>
                </div>

                <button
                  type="submit"
                  className="w-full rounded-xl bg-amber-500 py-3.5 font-semibold text-white shadow-lg shadow-amber-500/25 transition-all hover:bg-amber-600 hover:shadow-amber-500/30 active:scale-[0.99]"
                >
                  Continue
                </button>
              </form>
            ) : (
              <form onSubmit={handleFormSubmit} className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold text-[#1a1a1a] dark:text-white">
                    Complete your registration
                  </h2>
                  <p className="mt-1 text-sm text-[#5c5c5c] dark:text-gray-400">
                    Payment will be processed via E-Dahab
                  </p>
                  {effectiveRefCode && (
                    <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">
                      Joined via referral link – 20% discount applied
                    </p>
                  )}
                </div>

                {error && (
                  <div className="rounded-xl bg-red-50 dark:bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-400">
                    {error}
                  </div>
                )}

                <div>
                  <label className="mb-2 block text-sm font-medium text-[#1a1a1a] dark:text-white">
                    Membership plan
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {PLANS.map((p) => {
                      const discountedAmount = effectiveRefCode
                        ? Math.round(p.amount * (1 - REFERRAL_DISCOUNT) * 100) / 100
                        : p.amount;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setPlan(p.id)}
                          className={`relative rounded-xl border-2 px-4 py-3 text-left transition-all ${
                            plan === p.id
                              ? "border-amber-500 bg-amber-50 dark:border-amber-400 dark:bg-amber-500/10"
                              : "border-gray-200 bg-gray-50 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800/50 dark:hover:border-gray-600"
                          }`}
                        >
                          <span className="block font-semibold text-[#1a1a1a] dark:text-white">
                            {p.label}
                          </span>
                          <span className="mt-1 block text-lg font-bold text-amber-600 dark:text-amber-400">
                            {effectiveRefCode ? (
                              <>
                                <span className="line-through text-gray-400 dark:text-gray-500">
                                  ${p.amount.toFixed(2)}
                                </span>{" "}
                                ${discountedAmount.toFixed(2)}
                              </>
                            ) : (
                              `$${p.amount.toFixed(2)}`
                            )}
                          </span>
                          <span className="block text-xs text-[#5c5c5c] dark:text-gray-500">
                            {p.period}
                          </span>
                          {effectiveRefCode ? (
                            <span className="absolute right-2 top-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-500/20 dark:text-amber-400">
                              20% off
                            </span>
                          ) : p.save ? (
                            <span className="absolute right-2 top-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400">
                              {p.save}
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-[#1a1a1a] dark:text-white">
                    Phone
                  </label>
                  <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-300">
                    <span className="font-medium">{formatPhoneDisplay(phone)}</span>
                    <button
                      type="button"
                      onClick={() => setStep("phone")}
                      className="text-sm font-medium text-amber-600 hover:text-amber-700 dark:text-amber-400"
                    >
                      Change
                    </button>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-[#1a1a1a] dark:text-white">
                    Full name
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3.5 text-base text-[#1a1a1a] placeholder:text-gray-400 transition-colors focus:border-amber-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 dark:border-gray-700 dark:bg-gray-800/50 dark:text-white dark:placeholder:text-gray-500 dark:focus:border-amber-400 dark:focus:bg-gray-800"
                    placeholder="Enter your name"
                  />
                </div>

                <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-4 dark:border-gray-700 dark:bg-gray-800/30">
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      checked={useDifferentWhatsApp}
                      onChange={(e) => setUseDifferentWhatsApp(e.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-gray-300 text-amber-500 focus:ring-amber-500"
                    />
                    <span className="text-sm text-[#1a1a1a] dark:text-gray-300">
                      I&apos;m not using this phone for WhatsApp
                    </span>
                  </label>

                  {useDifferentWhatsApp && (
                    <div className="mt-4 space-y-3">
                      <label className="block text-sm font-medium text-[#1a1a1a] dark:text-white">
                        WhatsApp number
                      </label>
                      <div className="flex gap-2 min-w-0">
                        <select
                          value={whatsappCountry?.code ?? ""}
                          onChange={(e) => {
                            const code = e.target.value;
                            if (!code) return;
                            const c = countries.find((x) => x.code === code);
                            setWhatsappCountry(c || null);
                          }}
                          className="shrink-0 w-[140px] min-w-[120px] rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-[#1a1a1a] focus:border-amber-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                          disabled={countriesLoading}
                        >
                          {countriesLoading ? (
                            <option value="">Loading...</option>
                          ) : countries.length === 0 ? (
                            <option value="">No countries</option>
                          ) : (
                            countries.map((c) => (
                              <option key={c.code} value={c.code}>
                                {c.flag} {c.dial_code}
                              </option>
                            ))
                          )}
                        </select>
                        <input
                          type="tel"
                          value={whatsappNumber}
                          onChange={(e) =>
                            setWhatsappNumber(e.target.value.replace(/\D/g, ""))
                          }
                          placeholder={whatsappCountry?.dial_code?.includes("252") ? "612345678" : "Phone number"}
                          className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-[#1a1a1a] placeholder:text-gray-400 focus:border-amber-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder:text-gray-500"
                          inputMode="numeric"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl bg-amber-500 py-3.5 font-semibold text-white shadow-lg shadow-amber-500/25 transition-all hover:bg-amber-600 hover:shadow-amber-500/30 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg
                        className="h-5 w-5 animate-spin"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
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
                      Submitting...
                    </span>
                  ) : (
                    "Register"
                  )}
                </button>
              </form>
            )}
          </div>
        </div>

        
      </div>
    </div>
  );
}

export default function PayPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#faf8f5] dark:bg-[#0f0f0f] flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
      </div>
    }>
      <PayPageContent />
    </Suspense>
  );
}
