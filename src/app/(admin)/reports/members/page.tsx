"use client";

import React, { useEffect, useState } from "react";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import { authFetch } from "@/lib/api";

type Member = {
  id: number;
  name: string;
  phone: string;
  referralCode: string;
  status: string;
  createdAt: string;
  referredBy: { name: string; referralCode: string } | null;
  referrals: { id: number; name: string; phone: string }[];
};

export default function MembersReportPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authFetch("/api/members")
      .then((res) => (res.ok ? res.json() : []))
      .then(setMembers)
      .finally(() => setLoading(false));
  }, []);

  const activeCount = members.filter((m) => m.status === "Active").length;
  const pendingCount = members.filter((m) => m.status === "Pending").length;

  return (
    <div>
      <PageBreadCrumb pageTitle="Members Report" />
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/5">
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Members</p>
          <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
            {members.length}
          </p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/5">
          <p className="text-sm text-gray-500 dark:text-gray-400">Active</p>
          <p className="mt-2 text-2xl font-bold text-green-600 dark:text-green-400">
            {activeCount}
          </p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/5">
          <p className="text-sm text-gray-500 dark:text-gray-400">Pending</p>
          <p className="mt-2 text-2xl font-bold text-amber-600 dark:text-amber-400">
            {pendingCount}
          </p>
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/5">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-brand-500" />
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Name</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Phone</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Referral Code</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Referred By</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Referrals</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Status</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Joined</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="py-3 px-4 font-medium">{m.name}</td>
                    <td className="py-3 px-4">{m.phone}</td>
                    <td className="py-3 px-4 font-mono">{m.referralCode}</td>
                    <td className="py-3 px-4 text-gray-500">
                      {m.referredBy ? `${m.referredBy.name} (${m.referredBy.referralCode})` : "—"}
                    </td>
                    <td className="py-3 px-4">{m.referrals.length}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          m.status === "Active"
                            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                            : m.status === "Pending"
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                              : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400"
                        }`}
                      >
                        {m.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-500">
                      {new Date(m.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
