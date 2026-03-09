"use client";

import { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";

const SUCCESS_REDIRECT_URL =
  process.env.NEXT_PUBLIC_PAY_SUCCESS_URL ?? "https://somalidreams.com";

export default function PaySuccessPage() {
  // Optional: redirect after delay
  useEffect(() => {
    const timer = setTimeout(() => {
      window.location.href = SUCCESS_REDIRECT_URL;
    }, 5000);
    return () => clearTimeout(timer);
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
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-500/20 ring-4 ring-emerald-200/50 dark:ring-emerald-500/20">
              <svg
                className="h-10 w-10 text-emerald-600 dark:text-emerald-400"
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

            <h2 className="text-2xl font-bold text-[#1a1a1a] dark:text-white">
              Congratulations!
            </h2>

            <p className="mt-3 text-lg text-[#5c5c5c] dark:text-gray-400">
              Your payment was successful. You are now a member of Somali Dreams!
            </p>

            <div className="mt-6 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 px-4 py-4">
              <p className="text-base font-medium text-amber-800 dark:text-amber-200">
                We will send the Create Account Page to your WhatsApp phone number.
              </p>
              <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
                Please check your WhatsApp for your referral code and members area link.
              </p>
            </div>

            <Link
              href={SUCCESS_REDIRECT_URL}
              className="mt-8 inline-block w-full rounded-xl bg-amber-500 py-3.5 font-semibold text-white shadow-lg shadow-amber-500/25 transition-all hover:bg-amber-600"
            >
              Go to Somali Dreams
            </Link>

            <p className="mt-4 text-xs text-[#5c5c5c] dark:text-gray-500">
              Redirecting automatically in 5 seconds...
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
