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
  createdAt: string;
  referredBy: { id: number; name: string; phone: string; referralCode: string } | null;
  referrals: { id: number; name: string; phone: string; referralCode: string; createdAt: string }[];
  membershipPayments: { id: number; amount: number; paymentMethod: string; paidAt: string }[];
};

export default function MemberDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const [member, setMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!id) return;
    authFetch(`/api/members/${id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then(setMember)
      .finally(() => setLoading(false));
  }, [id]);

  async function handleConfirmPayment() {
    if (!member || !confirm("Confirm payment and send WhatsApp?")) return;
    setConfirming(true);
    try {
      const res = await authFetch(`/api/members/${member.id}/confirm-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: 0, paymentMethod: "E-Dahab" }),
      });
      if (res.ok) {
        const data = await res.json();
        setMember(data.member);
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
            onClick={handleConfirmPayment}
            disabled={confirming}
          >
            {confirming ? "Sending..." : "Confirm Payment & Send WhatsApp"}
          </Button>
        )}
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
    </div>
  );
}
