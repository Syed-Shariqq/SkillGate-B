import { useNavigate } from "react-router-dom";

/**
 * @param {{
 *   candidate: {
 *     id: string,
 *     rank: number,
 *     name: string,
 *     email: string,
 *     score: number,
 *     passed: boolean,
 *     confidence: "High" | "Medium" | "Low",
 *     tabSwitches: number,
 *     pasteAttempts: number,
 *     timeTaken: number,
 *     shortlisted: boolean,
 *     rejected: boolean,
 *   },
 *   selected: boolean,
 *   onSelect: (id: string) => void,
 *   onShortlist: (id: string) => void,
 *   onReject: (id: string) => void,
 *   skeleton?: boolean,
 * }} props
 */
const CandidateRow = ({
  candidate,
  selected = false,
  onSelect,
  onShortlist,
  onReject,
  skeleton = false,
}) => {
  const navigate = useNavigate();

  const formatTime = (seconds) => {
    const totalSeconds = Math.max(0, Number(seconds) || 0);
    const minutes = Math.floor(totalSeconds / 60);
    const remainingSeconds = totalSeconds % 60;

    return `${minutes}m ${remainingSeconds}s`;
  };

  if (skeleton) {
    return (
      <tr className="border-b border-border-default bg-secondary">
        <td className="px-4 py-4">
          <div className="h-4 w-4 animate-pulse rounded bg-tertiary" />
        </td>
        <td className="px-4 py-4">
          <div className="h-3 w-8 animate-pulse rounded bg-tertiary" />
        </td>
        <td className="px-4 py-4">
          <div className="space-y-2">
            <div className="h-4 w-36 animate-pulse rounded bg-tertiary" />
            <div className="h-3 w-28 animate-pulse rounded bg-tertiary" />
          </div>
        </td>
        <td className="px-4 py-4">
          <div className="h-3 w-32 animate-pulse rounded bg-tertiary" />
        </td>
        <td className="px-4 py-4">
          <div className="h-6 w-16 animate-pulse rounded-full bg-tertiary" />
        </td>
        <td className="px-4 py-4">
          <div className="h-4 w-14 animate-pulse rounded bg-tertiary" />
        </td>
        <td className="px-4 py-4">
          <div className="h-4 w-4 animate-pulse rounded bg-tertiary" />
        </td>
        <td className="px-4 py-4">
          <div className="h-4 w-20 animate-pulse rounded bg-tertiary" />
        </td>
        <td className="px-4 py-4">
          <div className="flex items-center gap-2">
            <div className="h-7 w-20 animate-pulse rounded bg-tertiary" />
            <div className="h-7 w-16 animate-pulse rounded bg-tertiary" />
          </div>
        </td>
      </tr>
    );
  }

  const {
    id,
    rank,
    name,
    email,
    score,
    passed,
    confidence,
    tabSwitches,
    pasteAttempts,
    timeTaken,
    shortlisted,
    rejected,
  } = candidate;

  const safeScore = Math.min(100, Math.max(0, Number(score) || 0));
  const scoreColor =
    safeScore >= 70
      ? "bg-success"
      : safeScore >= 50
        ? "bg-warning"
        : "bg-error";
  const confidenceColor =
    confidence === "High"
      ? "text-success"
      : confidence === "Medium"
        ? "text-warning"
        : "text-error";
  const hasFlag = tabSwitches > 0 || pasteAttempts > 0;

  const handleRowClick = () => {
    navigate(`/candidates/${id}`);
  };

  const stopRowClick = (event) => {
    event.stopPropagation();
  };

  return (
    <tr
      className={`group cursor-pointer border-b border-border-default bg-secondary transition-colors hover:bg-tertiary ${
        selected ? "border-l-2 border-l-accent bg-accent-soft" : "border-l-2 border-l-transparent"
      }`}
      onClick={handleRowClick}
    >
      <td className="px-4 py-4" onClick={stopRowClick}>
        <input
          aria-label={`Select ${name}`}
          checked={selected}
          className="h-4 w-4 cursor-pointer rounded border-border-default bg-primary text-accent focus:ring-accent"
          type="checkbox"
          onChange={() => onSelect(id)}
        />
      </td>
      <td className="px-4 py-4 font-mono text-sm text-text-tertiary">
        #{rank}
      </td>
      <td className="px-4 py-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-text-primary">
            {name}
          </p>
          <p className="mt-1 truncate text-xs text-text-tertiary">
            {email}
          </p>
        </div>
      </td>
      <td className="px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-tertiary">
            <div
              className={`h-full rounded-full ${scoreColor}`}
              style={{ width: `${safeScore}%` }}
            />
          </div>
          <span className="font-mono text-sm text-text-primary">
            {safeScore}%
          </span>
        </div>
      </td>
      <td className="px-4 py-4">
        <span
          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
            passed ? "bg-success/15 text-success" : "bg-error/15 text-error"
          }`}
        >
          {passed ? "Passed" : "Failed"}
        </span>
      </td>
      <td className={`px-4 py-4 text-sm font-medium ${confidenceColor}`}>
        {confidence}
      </td>
      <td className="px-4 py-4">
        {hasFlag ? (
          <svg
            aria-label="Candidate activity flag"
            className="h-4 w-4 text-warning"
            fill="none"
            title={`${tabSwitches} tab switch(es), ${pasteAttempts} paste attempt(s)`}
            viewBox="0 0 16 16"
          >
            <path
              d="M3 14V2.75M3 2.75h7.25l-.75 2.5.75 2.5H3"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.5"
            />
          </svg>
        ) : (
          <span className="text-sm text-text-tertiary">-</span>
        )}
      </td>
      <td className="px-4 py-4 text-sm text-text-secondary">
        {formatTime(timeTaken)}
      </td>
      <td className="px-4 py-4" onClick={stopRowClick}>
        <div className="flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            className={`rounded border px-2.5 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed ${
              shortlisted
                ? "border-accent bg-accent text-text-primary"
                : "border-accent text-accent hover:bg-accent hover:text-text-primary"
            }`}
            disabled={shortlisted}
            type="button"
            onClick={() => onShortlist(id)}
          >
            {shortlisted ? "Shortlisted" : "Shortlist"}
          </button>
          <button
            className={`rounded border px-2.5 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed ${
              rejected
                ? "border-error bg-error text-text-primary"
                : "border-error text-error hover:bg-error hover:text-text-primary"
            }`}
            disabled={rejected}
            type="button"
            onClick={() => onReject(id)}
          >
            {rejected ? "Rejected" : "Reject"}
          </button>
        </div>
      </td>
    </tr>
  );
};

export default CandidateRow;
