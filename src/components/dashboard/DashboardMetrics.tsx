"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Badge from "../ui/badge/Badge";
import {
  GroupIcon,
  DollarLineIcon,
  PageIcon,
  PieChartIcon,
} from "@/icons";
import { authFetch } from "@/lib/api";

type DashboardCounts = {
  members: number;
  active: number;
  pending: number;
  totalRevenue: number;
};

const metricCards: {
  key: keyof DashboardCounts;
  label: string;
  icon: React.ReactNode;
  href: string;
  color: "primary" | "success" | "info" | "warning" | "error";
}[] = [
  { key: "members", label: "Total Members", icon: <GroupIcon className="size-6" />, href: "/members", color: "primary" },
  { key: "active", label: "Active Members", icon: <PageIcon className="size-6" />, href: "/members?status=Active", color: "success" },
  { key: "pending", label: "Pending Payment", icon: <PieChartIcon className="size-6" />, href: "/members?status=Pending", color: "warning" },
  { key: "totalRevenue", label: "Total Revenue", icon: <DollarLineIcon className="size-6" />, href: "/members", color: "info" },
];

export default function DashboardMetrics() {
  const [counts, setCounts] = useState<DashboardCounts | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authFetch("/api/dashboard")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.counts) setCounts(data.counts);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4 md:gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/5 md:p-6 animate-pulse"
          >
            <div className="h-12 w-12 rounded-xl bg-gray-200 dark:bg-gray-800" />
            <div className="mt-5 h-4 w-24 rounded bg-gray-200 dark:bg-gray-800" />
            <div className="mt-2 h-8 w-16 rounded bg-gray-200 dark:bg-gray-800" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4 md:gap-6">
      {metricCards.map(({ key, label, icon, href, color }) => (
        <Link key={key} href={href}>
          <div className="rounded-2xl border border-gray-200 bg-white p-5 transition hover:border-brand-200 hover:shadow-sm dark:border-gray-800 dark:bg-white/5 dark:hover:border-brand-500/30 md:p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-white/90">
              {icon}
            </div>
            <div className="mt-5 flex items-end justify-between">
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
                <h4 className="mt-2 text-title-sm font-bold text-gray-800 dark:text-white/90">
                  {key === "totalRevenue"
                    ? `$${((counts?.[key] ?? 0) as number).toLocaleString()}`
                    : counts?.[key] ?? 0}
                </h4>
              </div>
              <Badge variant="light" color={color} size="sm">
                View
              </Badge>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
