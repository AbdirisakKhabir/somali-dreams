import type { Metadata } from "next";
import React from "react";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import DashboardMetrics from "@/components/dashboard/DashboardMetrics";
import RecentMembers from "@/components/dashboard/RecentMembers";

export const metadata: Metadata = {
  title: "Somali Dreams | Dashboard",
  description: "Somali Dreams Membership & Referral Dashboard",
};

export default function DashboardPage() {
  return (
    <div>
      <PageBreadCrumb pageTitle="Dashboard" />
      <div className="grid grid-cols-12 gap-4 md:gap-6">
        <div className="col-span-12 space-y-6">
          <DashboardMetrics />
        </div>
        <div className="col-span-12">
          <RecentMembers />
        </div>
      </div>
    </div>
  );
}
