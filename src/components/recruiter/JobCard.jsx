import React from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import SkeletonCard from '../ui/SkeletonCard';

const JobCard = ({
  id,
  title,
  companyName,
  status,
  candidateCount,
  avgScore,
  passRate,
  linkUsageCurrent,
  linkUsageMax,
  createdAt,
  loading = false
}) => {
  const navigate = useNavigate();

  if (loading) {
    return (
      <SkeletonCard
        rows={4}
        showAvatar={false}
        className="w-full"
      />
    );
  }

  // Format Helper: Percentage
  const formatPercentage = (value) => {
    if (value === null || value === undefined || value === '') {
      return '—';
    }
    const str = String(value);
    return str.endsWith('%') ? str : `${str}%`;
  };

  // Format Helper: Link Usage
  const formatLinkUsage = () => {
    const currentValid = linkUsageCurrent !== null && linkUsageCurrent !== undefined && linkUsageCurrent !== '';
    const maxValid = linkUsageMax !== null && linkUsageMax !== undefined && linkUsageMax !== '';
    if (currentValid && maxValid) {
      return `${linkUsageCurrent} / ${linkUsageMax}`;
    }
    return '—';
  };

  // Format Helper: Date
  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '—';

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC'
    });
  };

  // Navigation Handlers
  const handleClick = () => {
    navigate(`/jobs/${id}`);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleClick();
    }
  };

  // Status Badge Handling
  const isActive = typeof status === 'string' && status.toLowerCase() === 'active';
  const badgeVariant = isActive ? 'success' : 'default';
  const badgeLabel = isActive ? 'Active' : 'Inactive';

  return (
    <Card
      hoverable
      padding="md"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-label={`View details for job ${title} at ${companyName || 'unknown company'}`}
      className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent w-full md:max-w-md flex flex-col justify-between"
    >
      <div>
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 
              className="text-base font-bold text-text-primary truncate-2" 
              title={title}
            >
              {title}
            </h3>
            <p 
              className="mt-1 text-xs text-text-secondary truncate" 
              title={companyName}
            >
              {companyName || '—'}
            </p>
          </div>
          <div className="shrink-0 pt-0.5">
            <Badge variant={badgeVariant}>
              {badgeLabel}
            </Badge>
          </div>
        </div>

        {/* Divider */}
        <div className="divider my-3.5" />

        {/* Metrics Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 bg-primary/45 rounded-lg p-3 border border-border-default/60">
          {/* Candidate Count (Primary) */}
          <div className="bg-tertiary/40 border border-border-default rounded-md p-3 flex flex-col justify-between min-h-17">
            <span className="text-[10px] text-text-tertiary font-semibold uppercase tracking-wider">
              Candidates
            </span>
            <span className="text-2xl font-bold text-text-primary leading-none mt-2">
              {candidateCount ?? 0}
            </span>
          </div>

          {/* Secondary Metrics */}
          <div className="flex flex-col justify-center gap-2 py-0.5">
            <div className="flex justify-between items-center text-xs">
              <span className="text-text-tertiary">Avg Score</span>
              <span className="font-semibold text-text-secondary">
                {formatPercentage(avgScore)}
              </span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-text-tertiary">Pass Rate</span>
              <span className="font-semibold text-text-secondary">
                {formatPercentage(passRate)}
              </span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-text-tertiary">Link Usage</span>
              <span className="font-semibold text-text-secondary">
                {formatLinkUsage()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="divider my-3.5" />

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-text-tertiary">
        <span>Date Created</span>
        <span className="font-medium text-text-secondary">
          {formatDate(createdAt)}
        </span>
      </div>
    </Card>
  );
};

export default JobCard;
