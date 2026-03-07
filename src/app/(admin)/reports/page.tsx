import type { Metadata } from "next";
import React from "react";
import Link from "next/link";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import { PageIcon } from "@/icons";

export const metadata: Metadata = {
  title: "Reports | Somali Dreams",
  description: "Somali Dreams reports",
};

const reportLinks = [
  {
    name: "Members Report",
    path: "/reports/members",
    icon: PageIcon,
    description: "View all members with referral codes and referral counts",
  },
];

export default function ReportsIndexPage() {
  return (
    <div>
      <PageBreadCrumb pageTitle="Reports" />
      <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
        Select a report to view.
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {reportLinks.map((report) => (
          <Link key={report.path} href={report.path}>
            <div className="rounded-2xl border border-gray-200 bg-white p-6 transition hover:border-brand-200 hover:shadow-md dark:border-gray-800 dark:bg-white/5 dark:hover:border-brand-500/30">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 dark:bg-brand-500/10">
                <report.icon className="size-6 text-brand-600 dark:text-brand-400" />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-gray-800 dark:text-white/90">
                {report.name}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {report.description}
              </p>
              <p className="mt-3 text-sm font-medium text-brand-600 dark:text-brand-400">
                View Report →
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
