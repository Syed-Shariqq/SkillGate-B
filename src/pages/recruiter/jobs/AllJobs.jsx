import React, { useContext, useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import AuthContext from "../../../context/AuthContext";
import JobCard from "../../../components/recruiter/JobCard";
import EmptyState from "../../../components/ui/EmptyState";
import { getAllJobs } from "../../../services/jobsService";

const JOBS_PER_PAGE = 12;

const AllJobs = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  const [allJobs, setAllJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("All");
  const [sortBy, setSortBy] = useState("created_at");
  const [currentPage, setCurrentPage] = useState(1);

  const fetchJobs = async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await getAllJobs(user.id);
    if (fetchError) {
      setError("Failed to load jobs.");
    } else {
      setAllJobs(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchJobs();
  }, [user?.id]);

  const filteredJobs = useMemo(() => {
    let result = [...allJobs];

    if (activeTab === "Active") {
      result = result.filter((job) => job.is_active === true);
    } else if (activeTab === "Inactive") {
      result = result.filter((job) => job.is_active === false);
    } else if (activeTab === "Expired") {
      result = result.filter((job) => {
        if (!job.link_expires_at) return false;
        return new Date(job.link_expires_at) < new Date();
      });
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((job) =>
        job.title.toLowerCase().includes(query)
      );
    }

    result.sort((a, b) => {
      if (sortBy === "candidate_count") {
        return b.candidate_count - a.candidate_count;
      }
      if (sortBy === "pass_rate") {
        const aVal = a.pass_rate;
        const bVal = b.pass_rate;
        if (aVal === null && bVal === null) return 0;
        if (aVal === null) return 1;
        if (bVal === null) return -1;
        return bVal - aVal;
      }
      return new Date(b.created_at) - new Date(a.created_at);
    });

    return result;
  }, [allJobs, activeTab, searchQuery, sortBy]);

  const paginatedJobs = useMemo(() => {
    const startIndex = (currentPage - 1) * JOBS_PER_PAGE;
    return filteredJobs.slice(startIndex, startIndex + JOBS_PER_PAGE);
  }, [filteredJobs, currentPage]);

  const totalPages = Math.ceil(filteredJobs.length / JOBS_PER_PAGE);

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1);
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setCurrentPage(1);
  };

  const handleSortChange = (e) => {
    setSortBy(e.target.value);
    setCurrentPage(1);
  };

  const BriefcaseIcon = (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  );

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-text-primary text-2xl font-semibold font-sans">All Jobs</h1>
          <p className="text-sm text-text-secondary mt-1">Manage and track your active hiring pipelines.</p>
        </div>
        <button
          onClick={() => navigate("/jobs/create")}
          className="inline-flex items-center justify-center font-semibold rounded-lg bg-accent hover:bg-accent-hover text-text-primary px-5 py-2.5 text-sm transition-smooth gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Post a Job
        </button>
      </div>

      {/* Error State */}
      {error && (
        <div className="flex items-center justify-between gap-4 rounded-lg border border-error/25 bg-error/15 px-4 py-3 text-sm text-error">
          <span>{error}</span>
          <button
            onClick={fetchJobs}
            className="font-semibold text-error hover:text-text-primary transition-smooth"
          >
            Retry
          </button>
        </div>
      )}

      {/* Controls: Search, Sort, Filters */}
      {!loading && !error && allJobs.length > 0 && (
        <div className="space-y-4">
          {/* Tabs */}
          <div className="flex border-b border-border-default no-scrollbar overflow-x-auto">
            {["All", "Active", "Inactive", "Expired"].map((tab) => {
              const isTabActive = activeTab === tab;
              return (
                <button
                  key={tab}
                  onClick={() => handleTabChange(tab)}
                  className={`px-4 py-2 text-sm font-medium transition-smooth border-b-2 -mb-[2px] ${
                    isTabActive
                      ? "border-accent text-accent"
                      : "border-transparent text-text-secondary hover:text-text-primary"
                  }`}
                >
                  {tab}
                </button>
              );
            })}
          </div>

          {/* Search and Sort */}
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="relative w-full sm:max-w-xs">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-tertiary">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
              <input
                type="text"
                placeholder="Search jobs..."
                value={searchQuery}
                onChange={handleSearchChange}
                className="w-full pl-9 pr-4 py-2 bg-secondary border border-border-default rounded-lg text-text-primary placeholder-text-tertiary transition-smooth focus:border-accent focus:ring-1 focus:ring-accent outline-none text-sm"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end">
              <span className="text-xs font-medium text-text-secondary uppercase tracking-wider">Sort by:</span>
              <select
                value={sortBy}
                onChange={handleSortChange}
                className="bg-secondary border border-border-default rounded-lg text-text-primary transition-smooth focus:border-accent focus:ring-1 focus:ring-accent outline-none text-sm px-3 py-2 cursor-pointer"
              >
                <option value="created_at">Date Created</option>
                <option value="candidate_count">Most Candidates</option>
                <option value="pass_rate">Pass Rate</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Main Jobs Area */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <JobCard key={index} loading={true} skeleton={true} />
          ))}
        </div>
      ) : error ? (
        null
      ) : allJobs.length === 0 ? (
        <div className="rounded-xl border border-border-default bg-secondary p-8">
          <EmptyState
            icon={BriefcaseIcon}
            title="You haven't created any jobs yet"
            ctaLabel="Post a Job"
            onCtaClick={() => navigate("/jobs/create")}
          />
        </div>
      ) : filteredJobs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-text-tertiary text-base font-medium">No jobs match your search</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {paginatedJobs.map((job) => (
              <JobCard
                key={job.id}
                id={job.id}
                title={job.title}
                companyName={job.company_name}
                status={job.is_active ? "active" : "inactive"}
                candidateCount={job.candidate_count}
                avgScore={job.avg_score === null ? null : Math.round(job.avg_score)}
                passRate={job.pass_rate}
                linkUsageCurrent={job.link_use_count}
                linkUsageMax={job.link_max_uses}
                createdAt={job.created_at}
              />
            ))}
          </div>

          {/* Pagination */}
          {filteredJobs.length > JOBS_PER_PAGE && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-8 pt-6 border-t border-border-default">
              <span className="text-sm text-text-secondary">
                Page {currentPage} of {totalPages}
              </span>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 text-xs font-semibold rounded border border-border-default bg-secondary text-text-primary hover:bg-tertiary transition-smooth disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none"
                >
                  &laquo; First
                </button>

                <button
                  onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 text-xs font-semibold rounded border border-border-default bg-secondary text-text-primary hover:bg-tertiary transition-smooth disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none"
                >
                  Previous
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((page) => Math.abs(page - currentPage) <= 2)
                  .map((page) => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded border transition-smooth ${
                        currentPage === page
                          ? "bg-accent border-accent text-text-primary"
                          : "border-border-default bg-secondary text-text-primary hover:bg-tertiary"
                      }`}
                    >
                      {page}
                    </button>
                  ))}

                <button
                  onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 text-xs font-semibold rounded border border-border-default bg-secondary text-text-primary hover:bg-tertiary transition-smooth disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none"
                >
                  Next
                </button>

                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 text-xs font-semibold rounded border border-border-default bg-secondary text-text-primary hover:bg-tertiary transition-smooth disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none"
                >
                  Last &raquo;
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AllJobs;
