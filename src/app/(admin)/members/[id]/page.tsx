"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import Badge from "@/components/ui/badge/Badge";
import { authFetch } from "@/lib/api";
import { ChevronLeftIcon } from "@/icons";

type Member = {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  referralCode: string;
  status: string;
  membershipStartDate: string | null;
  membershipEndDate: string | null;
  createdAt: string;
  referredBy: { id: number; name: string; phone: string; referralCode: string } | null;
  referrals: { id: number; name: string; phone: string; referralCode: string; createdAt: string }[];
  membershipPayments: { id: number; amount: number; paymentMethod: string; paidAt: string }[];
  referralCommissions: {
    id: number;
    amount: number;
    referredMemberId: number;
    createdAt: string;
    referredMember?: { id: number; name: string; referralCode: string };
  }[];
};

const REFERRAL_DISCOUNT_RATE = Number(
  process.env.NEXT_PUBLIC_REFERRAL_DISCOUNT_RATE_PERCENT ?? "20"
);
const COMMISSION_PAYOUT_LIMIT = Number(
  process.env.NEXT_PUBLIC_COMMISSION_PAYOUT_LIMIT ?? "10"
);
const PAY_BASE_URL = (
  process.env.NEXT_PUBLIC_SOMALI_DREAMS_PAY_URL ?? "https://app.somalidreams.com/pay"
).replace(/\/$/, "");

export default function MemberDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const [member, setMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [approvalModal, setApprovalModal] = useState(false);
  const [approvalMessage, setApprovalMessage] = useState("");
  const [sendApprovalWhatsApp, setSendApprovalWhatsApp] = useState(true);
  const [discountRatePercent, setDiscountRatePercent] = useState(REFERRAL_DISCOUNT_RATE);
  const [commissionPayoutLimit, setCommissionPayoutLimit] = useState(COMMISSION_PAYOUT_LIMIT);
  const totalCommission =
    member?.referralCommissions?.reduce((sum, item) => sum + item.amount, 0) ?? 0;
  const isPayoutEligible = totalCommission >= commissionPayoutLimit;

  useEffect(() => {
    if (!id) return;
    authFetch(`/api/members/${id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then(setMember)
      .finally(() => setLoading(false));
  }, [id]);

  function buildApprovalMessage(currentMember: Member): string {
    const referralLink = `${PAY_BASE_URL}?ref=${encodeURIComponent(currentMember.referralCode)}`;
    return `Hambalyo! Ku Soo dhawoow Somali Dreams! 🎉

Lacag bixintaada waa la ansixiyay. Xubinnimadaadu hadda waa Active.

Referral Code-kaaga: ${currentMember.referralCode}
Riix linkigan oo la wadaag asxaabtaada (${discountRatePercent}% discount bisha 1aad):
${referralLink}

Marka commission-kaagu gaaro $${commissionPayoutLimit.toFixed(2)} waxaad codsan kartaa payout.

Mahadsanid! Somali Dreams`;
  }

  function openApprovalModal() {
    if (!member) return;
    setApprovalMessage(buildApprovalMessage(member));
    setSendApprovalWhatsApp(true);
    setApprovalModal(true);
  }

  async function handleConfirmPayment() {
    if (!member) return;
    setConfirming(true);
    try {
      const res = await authFetch(`/api/members/${member.id}/confirm-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentMethod: "E-Dahab",
          sendWhatsApp: sendApprovalWhatsApp,
          customMessage: approvalMessage.trim(),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setMember(data.member);
        setApprovalModal(false);
      } else {
        const data = await res.json();
        alert(data.error || "Failed");
      }
    } finally {
      setConfirming(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-brand-500" />
      </div>
    );
  }

  if (!member) {
    return (
      <div>
        <PageBreadCrumb pageTitle="Member" />
        <p className="text-gray-500">Member not found.</p>
        <Link href="/members" className="mt-4 text-brand-500 hover:underline">
          ← Back to Members
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            startIcon={<ChevronLeftIcon />}
            onClick={() => router.push("/members")}
          >
            Back
          </Button>
          <PageBreadCrumb pageTitle={member.name} />
        </div>
        {member.status === "Pending" && (
          <Button
            size="sm"
            onClick={openApprovalModal}
            disabled={confirming}
          >
            {confirming ? "Sending..." : "Approve Member"}
          </Button>
        )}
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/5">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-white/90">
            Discount Rate Customization
          </h3>
          <div className="mt-3 flex items-center gap-2">
            <input
              type="number"
              min={0}
              max={100}
              step={1}
              value={discountRatePercent}
              onChange={(e) =>
                setDiscountRatePercent(
                  Math.min(100, Math.max(0, Number(e.target.value || 0)))
                )
              }
              className="h-10 w-28 rounded-lg border border-gray-200 bg-transparent px-3 text-sm text-gray-700 outline-none dark:border-gray-700 dark:text-gray-300"
            />
            <span className="text-sm text-gray-600 dark:text-gray-400">%</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDiscountRatePercent(REFERRAL_DISCOUNT_RATE)}
            >
              Reset
            </Button>
          </div>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/5">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-white/90">
            Commission Payout Section
          </h3>
          <div className="mt-3 flex items-center gap-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">$</span>
            <input
              type="number"
              min={0}
              step={0.5}
              value={commissionPayoutLimit}
              onChange={(e) =>
                setCommissionPayoutLimit(Math.max(0, Number(e.target.value || 0)))
              }
              className="h-10 w-28 rounded-lg border border-gray-200 bg-transparent px-3 text-sm text-gray-700 outline-none dark:border-gray-700 dark:text-gray-300"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCommissionPayoutLimit(COMMISSION_PAYOUT_LIMIT)}
            >
              Reset
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/5">
          <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
            Member Info
          </h3>
          <dl className="space-y-3">
            <div>
              <dt className="text-sm text-gray-500 dark:text-gray-400">Name</dt>
              <dd className="font-medium">{member.name}</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500 dark:text-gray-400">Phone</dt>
              <dd className="font-medium">{member.phone}</dd>
            </div>
            {member.email && (
              <div>
                <dt className="text-sm text-gray-500 dark:text-gray-400">Email</dt>
                <dd>{member.email}</dd>
              </div>
            )}
            <div>
              <dt className="text-sm text-gray-500 dark:text-gray-400">Referral Code</dt>
              <dd className="font-mono font-semibold text-brand-600 dark:text-brand-400">
                {member.referralCode}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500 dark:text-gray-400">Status</dt>
              <dd>
                <Badge
                  color={
                    member.status === "Active"
                      ? "success"
                      : member.status === "Pending"
                        ? "warning"
                        : "error"
                  }
                  size="sm"
                >
                  {member.status}
                </Badge>
              </dd>
            </div>
            {member.membershipStartDate && (
              <div>
                <dt className="text-sm text-gray-500 dark:text-gray-400">Membership Start</dt>
                <dd>{new Date(member.membershipStartDate).toLocaleDateString()}</dd>
              </div>
            )}
            {member.membershipEndDate && (
              <div>
                <dt className="text-sm text-gray-500 dark:text-gray-400">Membership End</dt>
                <dd>{new Date(member.membershipEndDate).toLocaleDateString()}</dd>
              </div>
            )}
            {member.referredBy && (
              <div>
                <dt className="text-sm text-gray-500 dark:text-gray-400">Referred By</dt>
                <dd>
                  <Link
                    href={`/members/${member.referredBy.id}`}
                    className="text-brand-500 hover:underline"
                  >
                    {member.referredBy.name} ({member.referredBy.referralCode})
                  </Link>
                </dd>
              </div>
            )}
            <div>
              <dt className="text-sm text-gray-500 dark:text-gray-400">Commission Received</dt>
              <dd className="font-semibold text-emerald-600 dark:text-emerald-400">
                ${totalCommission.toFixed(2)}
              </dd>
              <dd className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Payout limit: ${commissionPayoutLimit.toFixed(2)} (
                {isPayoutEligible ? "eligible" : "not yet eligible"})
              </dd>
            </div>
          </dl>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/5">
          <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
            Friends Who Used Their Referral Code
          </h3>
          {member.referrals.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No referrals yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {member.referrals.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2 dark:border-gray-800"
                >
                  <Link
                    href={`/members/${r.id}`}
                    className="font-medium text-gray-900 dark:text-white hover:text-brand-500"
                  >
                    {r.name}
                  </Link>
                  <span className="text-sm text-gray-500">{r.phone}</span>
                  <Badge variant="light" size="sm">
                    {r.referralCode}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {member.referralCommissions && member.referralCommissions.length > 0 && (
        <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/5">
          <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
            Commission History
          </h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="py-2 text-left font-medium text-gray-500">Date</th>
                <th className="py-2 text-left font-medium text-gray-500">From</th>
                <th className="py-2 text-left font-medium text-gray-500">Amount</th>
              </tr>
            </thead>
            <tbody>
              {member.referralCommissions.map((c) => (
                <tr key={c.id} className="border-b border-gray-100 dark:border-gray-800">
                  <td className="py-2">
                    {new Date(c.createdAt).toLocaleDateString()}
                  </td>
                  <td className="py-2">
                    {c.referredMember ? (
                      <Link
                        href={`/members/${c.referredMember.id}`}
                        className="text-brand-500 hover:underline"
                      >
                        {c.referredMember.name} ({c.referredMember.referralCode})
                      </Link>
                    ) : (
                      `Member #${c.referredMemberId}`
                    )}
                  </td>
                  <td className="py-2 font-medium text-emerald-600 dark:text-emerald-400">
                    ${c.amount.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/5">
        <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
          Payment History
        </h3>
        {member.membershipPayments.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No payments recorded.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-2 font-medium text-gray-500">Date</th>
                <th className="text-left py-2 font-medium text-gray-500">Amount</th>
                <th className="text-left py-2 font-medium text-gray-500">Method</th>
              </tr>
            </thead>
            <tbody>
              {member.membershipPayments.map((p) => (
                <tr key={p.id} className="border-b border-gray-100 dark:border-gray-800">
                  <td className="py-2">
                    {new Date(p.paidAt).toLocaleDateString()}
                  </td>
                  <td className="py-2">${p.amount.toLocaleString()}</td>
                  <td className="py-2">{p.paymentMethod}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {approvalModal && member && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">
                Approve {member.name}
              </h2>
              <button
                type="button"
                onClick={() => setApprovalModal(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-4 px-6 py-5">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={sendApprovalWhatsApp}
                  onChange={(e) => setSendApprovalWhatsApp(e.target.checked)}
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Send WhatsApp approval message
                </span>
              </label>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Message customization
                </label>
                <textarea
                  value={approvalMessage}
                  onChange={(e) => setApprovalMessage(e.target.value)}
                  rows={7}
                  disabled={!sendApprovalWhatsApp}
                  className="w-full rounded-lg border border-gray-200 bg-transparent px-4 py-3 text-sm text-gray-800 outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-500/20 disabled:opacity-60 dark:border-gray-700 dark:text-white dark:focus:border-brand-500/40"
                />
                <a
                  href={`${PAY_BASE_URL}?ref=${encodeURIComponent(member.referralCode)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-block text-xs text-brand-500 hover:underline"
                >
                  Open referral link
                </a>
              </div>
              <div className="flex items-center justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setApprovalModal(false)} size="sm">
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleConfirmPayment}
                  disabled={confirming}
                  size="sm"
                >
                  {confirming ? "Approving..." : "Approve Member"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
