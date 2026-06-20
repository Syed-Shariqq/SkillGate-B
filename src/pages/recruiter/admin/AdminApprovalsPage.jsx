import React from "react";
import toast from "react-hot-toast";
import RecruiterLayout from "@/layouts/RecruiterLayout";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import {
  usePendingAccountsQuery,
  useApproveAccountMutation,
  useRejectAccountMutation,
} from "@/hooks/queries/useAdminQuery";

const AdminApprovalsPage = () => {
  const { data: pendingAccounts, isLoading, error, refetch } = usePendingAccountsQuery();
  const approveMutation = useApproveAccountMutation();
  const rejectMutation = useRejectAccountMutation();

  const handleApprove = async (id, name) => {
    try {
      await approveMutation.mutateAsync(id);
      toast.success(`Approved recruiter: ${name}`);
    } catch (err) {
      toast.error("Failed to approve account.");
    }
  };

  const handleReject = async (id, name) => {
    if (!window.confirm(`Are you sure you want to reject the application for ${name}?`)) {
      return;
    }
    try {
      await rejectMutation.mutateAsync(id);
      toast.success(`Rejected recruiter: ${name}`);
    } catch (err) {
      toast.error("Failed to reject account.");
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatWebsite = (url) => {
    if (!url) return "N/A";
    const cleanUrl = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    return (
      <a
        href={cleanUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-accent hover:underline break-all"
      >
        {url.replace(/^(https?:\/\/)?(www\.)?/, "")}
      </a>
    );
  };

  return (
    <RecruiterLayout>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div>
          <h1 className="text-text-primary text-2xl font-semibold font-sans">
            Pending Recruiter Approvals
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Review and approve or reject signups from generic email providers.
          </p>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="animate-pulse h-28 bg-secondary border border-border-default" />
            ))}
          </div>
        ) : error ? (
          <div className="flex items-center justify-between gap-4 rounded-lg border border-error/25 bg-error/15 px-4 py-3 text-sm text-error">
            <span>Failed to load pending accounts.</span>
            <button
              onClick={refetch}
              className="font-semibold text-error hover:text-text-primary transition-smooth"
            >
              Retry
            </button>
          </div>
        ) : pendingAccounts.length === 0 ? (
          <Card className="flex flex-col items-center justify-center p-12 text-center bg-secondary border border-border-default">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-success/10 text-success">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-text-primary">All Caught Up!</h3>
            <p className="text-sm text-text-secondary mt-1">
              There are no recruiter accounts awaiting approval.
            </p>
          </Card>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border-default bg-secondary">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border-default bg-tertiary/50 text-xs font-semibold uppercase tracking-wider text-text-secondary">
                  <th className="px-6 py-4">Recruiter</th>
                  <th className="px-6 py-4">Company Details</th>
                  <th className="px-6 py-4">Registration Email</th>
                  <th className="px-6 py-4">Signup Date</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-default text-sm text-text-primary">
                {pendingAccounts.map((account) => (
                  <tr key={account.id} className="hover:bg-tertiary/20 transition-smooth">
                    <td className="px-6 py-4">
                      <div className="font-medium text-text-primary">{account.full_name || "N/A"}</div>
                      <div className="text-xs text-text-secondary">{account.email}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-text-primary">{account.company_name || "N/A"}</div>
                      <div className="text-xs text-text-secondary mt-0.5">
                        {formatWebsite(account.company_website)}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs">
                      {account.work_email || account.email}
                    </td>
                    <td className="px-6 py-4 text-text-secondary">
                      {formatDate(account.created_at)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleReject(account.id, account.full_name)}
                          disabled={approveMutation.isPending || rejectMutation.isPending}
                          className="text-error hover:bg-error/10 hover:text-error"
                        >
                          Reject
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleApprove(account.id, account.full_name)}
                          disabled={approveMutation.isPending || rejectMutation.isPending}
                          className="bg-success text-white hover:bg-success/90 border-transparent"
                        >
                          Approve
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </RecruiterLayout>
  );
};

export default AdminApprovalsPage;
