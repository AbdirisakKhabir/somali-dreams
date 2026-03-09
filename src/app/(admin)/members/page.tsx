"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Badge from "@/components/ui/badge/Badge";
import { authFetch } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { PencilIcon, PlusIcon, TrashBinIcon, PaperPlaneIcon } from "@/icons";

type MemberRow = {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  referralCode: string;
  status: string;
  createdAt: string;
  referredBy: { name: string; referralCode: string } | null;
  referrals: { id: number; name: string; phone: string; referralCode: string }[];
  membershipPayments: { amount: number; paymentMethod: string; paidAt: string }[];
  referralCommissions: { amount: number }[];
};

export default function MembersPage() {
  const { hasPermission } = useAuth();
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<"add" | "edit" | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [searchName, setSearchName] = useState("");
  const [searchPhone, setSearchPhone] = useState("");
  const [searchReferral, setSearchReferral] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [referralFilter, setReferralFilter] = useState<string>(""); // "", "has", "none"
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [messageModal, setMessageModal] = useState(false);
  const [customMessage, setCustomMessage] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [sendResult, setSendResult] = useState<{ sent: number; failed: number; results?: { name: string; success: boolean; error?: string }[] } | null>(null);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    referredByCode: "",
    status: "Active",
    sendWelcome: true,
  });
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);

  const canView = hasPermission("members.view") || hasPermission("dashboard.view");
  const canCreate = hasPermission("members.create");
  const canEdit = hasPermission("members.edit");
  const canDelete = hasPermission("members.delete");

  async function loadMembers() {
    const res = await authFetch("/api/members");
    if (res.ok) {
      const data = await res.json();
      setMembers(data);
    }
  }

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadMembers();
      setLoading(false);
    })();
  }, []);

  function openAdd() {
    setModal("add");
    setEditingId(null);
    setForm({
      name: "",
      phone: "",
      email: "",
      referredByCode: "",
      status: "Active",
      sendWelcome: true,
    });
    setSubmitError("");
  }

  function openEdit(m: MemberRow) {
    setModal("edit");
    setEditingId(m.id);
    setForm({
      name: m.name,
      phone: m.phone,
      email: m.email ?? "",
      referredByCode: m.referredBy?.referralCode ?? "",
      status: m.status,
      sendWelcome: false,
    });
    setSubmitError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError("");
    setSubmitting(true);
    try {
      if (modal === "add") {
        const res = await authFetch("/api/members", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name,
            phone: form.phone,
            email: form.email || undefined,
            referredByCode: form.referredByCode || undefined,
            status: form.status,
            sendWelcome: form.sendWelcome,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setSubmitError(data.error || "Failed to create member");
          return;
        }
        await loadMembers();
        setModal(null);
      } else if (modal === "edit" && editingId) {
        const res = await authFetch(`/api/members/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name,
            phone: form.phone,
            email: form.email || undefined,
            status: form.status,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setSubmitError(data.error || "Failed to update member");
          return;
        }
        await loadMembers();
        setModal(null);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirmPayment(id: number) {
    if (!confirm("Confirm payment received and send WhatsApp welcome?")) return;
    setConfirmingId(id);
    try {
      const res = await authFetch(`/api/members/${id}/confirm-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: 0, paymentMethod: "E-Dahab" }),
      });
      const data = await res.json();
      if (res.ok) {
        await loadMembers();
      } else {
        alert(data.error || "Failed to confirm payment");
      }
    } finally {
      setConfirmingId(null);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Are you sure you want to delete this member?")) return;
    const res = await authFetch(`/api/members/${id}`, { method: "DELETE" });
    if (res.ok) await loadMembers();
    else {
      const data = await res.json();
      alert(data.error || "Failed to delete");
    }
  }

  const filtered = members.filter((m) => {
    const matchSearch =
      !search.trim() ||
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.phone.includes(search) ||
      m.referralCode.toLowerCase().includes(search.toLowerCase());
    const matchName = !searchName.trim() || m.name.toLowerCase().includes(searchName.toLowerCase());
    const matchPhone = !searchPhone.trim() || m.phone.includes(searchPhone);
    const matchReferral = !searchReferral.trim() || m.referralCode.toLowerCase().includes(searchReferral.toLowerCase());
    const matchStatus = !statusFilter || m.status === statusFilter;
    const matchReferralFilter =
      !referralFilter ||
      (referralFilter === "has" && m.referrals.length > 0) ||
      (referralFilter === "none" && m.referrals.length === 0);
    return matchSearch && matchName && matchPhone && matchReferral && matchStatus && matchReferralFilter;
  });

  const selectedCount = selectedIds.size;
  const selectedFiltered = filtered.filter((m) => selectedIds.has(m.id));
  const allFilteredSelected = filtered.length > 0 && selectedFiltered.length === filtered.length;

  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (allFilteredSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((m) => m.id)));
    }
  }

  async function handleSendMessage() {
    if (selectedFiltered.length === 0 || !customMessage.trim()) return;
    setSendingMessage(true);
    setSendResult(null);
    try {
      const res = await authFetch("/api/whatsapp/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberIds: selectedFiltered.map((m) => m.id),
          message: customMessage.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSendResult({
          sent: data.sent,
          failed: data.failed,
          results: data.results,
        });
        if (data.failed === 0) {
          setSelectedIds(new Set());
          setMessageModal(false);
          setCustomMessage("");
        }
      } else {
        setSendResult({ sent: 0, failed: selectedFiltered.length, results: [] });
      }
    } catch {
      setSendResult({ sent: 0, failed: selectedFiltered.length, results: [] });
    } finally {
      setSendingMessage(false);
    }
  }

  function openMessageModal() {
    setCustomMessage("");
    setSendResult(null);
    setMessageModal(true);
  }

  if (!canView) {
    return (
      <div>
        <PageBreadCrumb pageTitle="Members" />
        <div className="mt-6 flex flex-col items-center justify-center rounded-2xl border border-gray-200 bg-white px-6 py-16 dark:border-gray-800 dark:bg-white/3">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
            You do not have permission to view members.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageBreadCrumb pageTitle="Members" />
        <div className="flex items-center gap-2">
          <a
            href="/pay"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-brand-500 hover:underline"
          >
            Payment Page →
          </a>
          {selectedCount > 0 && (
            <Button
              startIcon={<PaperPlaneIcon />}
              onClick={openMessageModal}
              size="sm"
              variant="outline"
            >
              Send Message ({selectedCount})
            </Button>
          )}
          {canCreate && (
            <Button startIcon={<PlusIcon />} onClick={openAdd} size="sm">
              Add Member
            </Button>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/3">
        <div className="flex flex-col gap-4 border-b border-gray-200 px-5 py-4 dark:border-gray-800">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">
                All Members
              </h3>
              <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-brand-50 px-1.5 text-xs font-semibold text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
                {filtered.length}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
            <input
              type="text"
              placeholder="Search all..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 rounded-lg border border-gray-200 bg-transparent px-3 text-sm text-gray-700 outline-none placeholder:text-gray-400 focus:border-brand-300 dark:border-gray-700 dark:text-gray-300"
            />
            <input
              type="text"
              placeholder="Name"
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              className="h-10 rounded-lg border border-gray-200 bg-transparent px-3 text-sm text-gray-700 outline-none placeholder:text-gray-400 focus:border-brand-300 dark:border-gray-700 dark:text-gray-300"
            />
            <input
              type="text"
              placeholder="Phone"
              value={searchPhone}
              onChange={(e) => setSearchPhone(e.target.value)}
              className="h-10 rounded-lg border border-gray-200 bg-transparent px-3 text-sm text-gray-700 outline-none placeholder:text-gray-400 focus:border-brand-300 dark:border-gray-700 dark:text-gray-300"
            />
            <input
              type="text"
              placeholder="Referral code"
              value={searchReferral}
              onChange={(e) => setSearchReferral(e.target.value)}
              className="h-10 rounded-lg border border-gray-200 bg-transparent px-3 text-sm text-gray-700 outline-none placeholder:text-gray-400 focus:border-brand-300 dark:border-gray-700 dark:text-gray-300"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-10 rounded-lg border border-gray-200 bg-transparent px-3 text-sm dark:border-gray-700 dark:text-gray-300"
            >
              <option value="">All statuses</option>
              <option value="Active">Active</option>
              <option value="Pending">Pending</option>
              <option value="Inactive">Inactive</option>
            </select>
            <select
              value={referralFilter}
              onChange={(e) => setReferralFilter(e.target.value)}
              className="h-10 rounded-lg border border-gray-200 bg-transparent px-3 text-sm dark:border-gray-700 dark:text-gray-300"
            >
              <option value="">All referrals</option>
              <option value="has">Has referrals</option>
              <option value="none">No referrals</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-brand-500 dark:border-gray-700 dark:border-t-brand-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
              {search || statusFilter ? "No members match." : "No members yet."}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-transparent! hover:bg-transparent!">
                <TableCell isHeader className="w-10">
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 rounded border-gray-300 text-brand-500 focus:ring-brand-500"
                    aria-label="Select all"
                  />
                </TableCell>
                <TableCell isHeader>Name</TableCell>
                <TableCell isHeader>Phone</TableCell>
                <TableCell isHeader>Referral Code</TableCell>
                <TableCell isHeader>Referred By</TableCell>
                <TableCell isHeader>Referrals</TableCell>
                <TableCell isHeader>Commission</TableCell>
                <TableCell isHeader>Status</TableCell>
                <TableCell isHeader className="text-right">Actions</TableCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="w-10">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(m.id)}
                      onChange={() => toggleSelect(m.id)}
                      className="h-4 w-4 rounded border-gray-300 text-brand-500 focus:ring-brand-500"
                      aria-label={`Select ${m.name}`}
                    />
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/members/${m.id}`}
                      className="font-medium text-gray-800 dark:text-white/90 hover:text-brand-500"
                    >
                      {m.name}
                    </Link>
                  </TableCell>
                  <TableCell>{m.phone}</TableCell>
                  <TableCell className="font-mono text-sm">{m.referralCode}</TableCell>
                  <TableCell className="text-gray-500 dark:text-gray-400">
                    {m.referredBy
                      ? `${m.referredBy.name} (${m.referredBy.referralCode})`
                      : "—"}
                  </TableCell>
                  <TableCell>
                    {m.referrals.length > 0 ? (
                      <Link
                        href={`/members/${m.id}`}
                        className="text-brand-500 hover:underline"
                      >
                        {m.referrals.length} friend{m.referrals.length !== 1 ? "s" : ""}
                      </Link>
                    ) : (
                      "0"
                    )}
                  </TableCell>
                  <TableCell className="font-medium text-emerald-600 dark:text-emerald-400">
                    ${(m.referralCommissions?.reduce((s, c) => s + c.amount, 0) ?? 0).toFixed(2)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      color={
                        m.status === "Active"
                          ? "success"
                          : m.status === "Pending"
                            ? "warning"
                            : "error"
                      }
                      size="sm"
                    >
                      {m.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex items-center gap-1">
                      {m.status === "Pending" && (
                        <button
                          type="button"
                          onClick={() => handleConfirmPayment(m.id)}
                          disabled={confirmingId === m.id}
                          className="inline-flex h-8 items-center justify-center rounded-lg bg-green-100 px-2 text-xs font-medium text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50"
                        >
                          {confirmingId === m.id ? "..." : "Confirm Payment"}
                        </button>
                      )}
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => openEdit(m)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-brand-50 hover:text-brand-500 dark:hover:bg-brand-500/10"
                          aria-label="Edit"
                        >
                          <PencilIcon className="h-4 w-4" />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => handleDelete(m.id)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-error-50 hover:text-error-500 dark:hover:bg-error-500/10"
                          aria-label="Delete"
                        >
                          <TrashBinIcon className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md animate-in fade-in zoom-in-95 rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">
                {modal === "add" ? "Add Member" : "Edit Member"}
              </h2>
              <button
                type="button"
                onClick={() => setModal(null)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="px-6 py-5">
              <div className="space-y-4">
                {submitError && (
                  <div className="rounded-lg bg-error-50 px-4 py-3 text-sm text-error-600 dark:bg-error-500/10 dark:text-error-400">
                    {submitError}
                  </div>
                )}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Name <span className="text-error-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Member name"
                    className="h-11 w-full rounded-lg border border-gray-200 bg-transparent px-4 py-2.5 text-sm text-gray-800 outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:text-white dark:focus:border-brand-500/40"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Phone <span className="text-error-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    placeholder="252 61 1234567"
                    className="h-11 w-full rounded-lg border border-gray-200 bg-transparent px-4 py-2.5 text-sm text-gray-800 outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:text-white dark:focus:border-brand-500/40"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Email
                  </label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder="optional@email.com"
                    className="h-11 w-full rounded-lg border border-gray-200 bg-transparent px-4 py-2.5 text-sm text-gray-800 outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:text-white dark:focus:border-brand-500/40"
                  />
                </div>
                {modal === "add" && (
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Referred by (code)
                    </label>
                    <input
                      type="text"
                      value={form.referredByCode}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, referredByCode: e.target.value.toUpperCase() }))
                      }
                      placeholder="SD-ABC123"
                      className="h-11 w-full rounded-lg border border-gray-200 bg-transparent px-4 py-2.5 text-sm text-gray-800 outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:text-white dark:focus:border-brand-500/40"
                    />
                  </div>
                )}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Status
                  </label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                    className="h-11 w-full appearance-none rounded-lg border border-gray-200 bg-transparent px-4 py-2.5 text-sm text-gray-800 outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:text-white dark:focus:border-brand-500/40"
                  >
                    <option value="Active">Active</option>
                    <option value="Pending">Pending</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
                {modal === "add" && (
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={form.sendWelcome}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, sendWelcome: e.target.checked }))
                      }
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      Send welcome WhatsApp
                    </span>
                  </label>
                )}
              </div>

              <div className="mt-6 flex items-center justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setModal(null)} size="sm">
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting} size="sm">
                  {submitting ? "Saving..." : modal === "add" ? "Create" : "Update"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {messageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg animate-in fade-in zoom-in-95 rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">
                Send WhatsApp to {selectedFiltered.length} member{selectedFiltered.length !== 1 ? "s" : ""}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setMessageModal(false);
                  setSendResult(null);
                }}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {sendResult ? (
                <div className="space-y-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Sent: {sendResult.sent} | Failed: {sendResult.failed}
                  </p>
                  {sendResult.results && sendResult.failed > 0 && (
                    <div className="max-h-32 overflow-y-auto rounded-lg bg-gray-50 p-3 text-xs dark:bg-gray-800">
                      {sendResult.results
                        .filter((r) => !r.success)
                        .map((r) => (
                          <div key={r.name} className="text-error-600 dark:text-error-400">
                            {r.name}: {r.error}
                          </div>
                        ))}
                    </div>
                  )}
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      onClick={() => {
                        setMessageModal(false);
                        setSendResult(null);
                        if (sendResult.failed === 0) setSelectedIds(new Set());
                      }}
                      size="sm"
                    >
                      Done
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Custom message
                    </label>
                    <textarea
                      value={customMessage}
                      onChange={(e) => setCustomMessage(e.target.value)}
                      placeholder="Type your message here..."
                      rows={5}
                      className="w-full rounded-lg border border-gray-200 bg-transparent px-4 py-3 text-sm text-gray-800 outline-none placeholder:text-gray-400 focus:border-brand-300 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:text-white dark:focus:border-brand-500/40"
                    />
                  </div>
                  <div className="flex items-center justify-end gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setMessageModal(false);
                        setSendResult(null);
                      }}
                      size="sm"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      onClick={handleSendMessage}
                      disabled={sendingMessage || !customMessage.trim()}
                      startIcon={<PaperPlaneIcon />}
                      size="sm"
                    >
                      {sendingMessage ? "Sending..." : "Send"}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
