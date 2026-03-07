"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Badge from "../ui/badge/Badge";
import { authFetch } from "@/lib/api";

type Member = {
  id: number;
  name: string;
  phone: string;
  referralCode: string;
  status: string;
  createdAt: string;
  referredBy: { name: string; referralCode: string } | null;
  _count: { referrals: number };
};

export default function RecentMembers() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authFetch("/api/dashboard")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.recentMembers) setMembers(data.recentMembers);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/5">
        <div className="h-6 w-40 rounded bg-gray-200 dark:bg-gray-800" />
        <div className="mt-4 space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-12 rounded bg-gray-200 dark:bg-gray-800 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/5">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Recent Members
        </h3>
        <Link
          href="/members"
          className="text-sm font-medium text-brand-500 hover:text-brand-600"
        >
          View all
        </Link>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="text-left py-2 font-medium text-gray-500 dark:text-gray-400">Name</th>
              <th className="text-left py-2 font-medium text-gray-500 dark:text-gray-400">Phone</th>
              <th className="text-left py-2 font-medium text-gray-500 dark:text-gray-400">Referral Code</th>
              <th className="text-left py-2 font-medium text-gray-500 dark:text-gray-400">Referred By</th>
              <th className="text-left py-2 font-medium text-gray-500 dark:text-gray-400">Referrals</th>
              <th className="text-left py-2 font-medium text-gray-500 dark:text-gray-400">Status</th>
            </tr>
          </thead>
          <tbody>
            {members.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-gray-500 dark:text-gray-400">
                  No members yet
                </td>
              </tr>
            ) : (
              members.map((m) => (
                <tr key={m.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="py-3">
                    <Link href={`/members/${m.id}`} className="font-medium text-gray-900 dark:text-white hover:text-brand-500">
                      {m.name}
                    </Link>
                  </td>
                  <td className="py-3 text-gray-600 dark:text-gray-400">{m.phone}</td>
                  <td className="py-3 font-mono text-sm">{m.referralCode}</td>
                  <td className="py-3 text-gray-600 dark:text-gray-400">
                    {m.referredBy ? `${m.referredBy.name} (${m.referredBy.referralCode})` : ""}
                  </td>
                  <td className="py-3">{m._count.referrals}</td>
                  <td className="py-3">
                    <Badge
                      variant="light"
                      color={m.status === "Active" ? "success" : m.status === "Pending" ? "warning" : "error"}
                      size="sm"
                    >
                      {m.status}
                    </Badge>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
