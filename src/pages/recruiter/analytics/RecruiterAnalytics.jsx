import React, { useContext, useEffect, useState } from 'react';
import AuthContext from '@/context/AuthContext';
import { getAnalyticsData, getJobsList } from '@/services/recruiter/analyticsService';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LineChart,
  Line,
} from 'recharts';

const RecruiterAnalytics = () => {
  const { user } = useContext(AuthContext);
  const [selectedJob, setSelectedJob] = useState('all');
  const [dateRange, setDateRange] = useState('30d');
  const [analytics, setAnalytics] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user?.id) return;

    let isMounted = true;

    const fetchJobs = async () => {
      const { data, error: jobsError } = await getJobsList(user.id);
      if (isMounted) {
        if (!jobsError) {
          setJobs(data || []);
        }
      }
    };

    fetchJobs();

    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    let isMounted = true;

    const fetchAnalytics = async () => {
      setLoading(true);
      const { data, error: analyticsError } = await getAnalyticsData(
        user.id,
        selectedJob,
        dateRange
      );
      if (isMounted) {
        if (analyticsError) {
          setError('Failed to fetch analytics data.');
          setAnalytics(null);
        } else {
          setAnalytics(data);
          setError(null);
        }
        setLoading(false);
      }
    };

    fetchAnalytics();

    return () => {
      isMounted = false;
    };
  }, [user?.id, selectedJob, dateRange]);

  const completionRate = analytics?.completionRate ?? 0;
  const passRate = analytics?.passRate ?? 0;
  const avgScore = analytics?.avgScore;
  const funnel = analytics?.funnel ?? { opened: null, started: 0, completed: 0, passed: 0 };
  const scoreDistribution = analytics?.scoreDistribution ?? [];
  const completionTrend = analytics?.completionTrend ?? [];
  const missedSkills = analytics?.missedSkills ?? [];

  const hasNoCompleted = !analytics || funnel.completed === 0;

  const getScoreTextClass = (score) => {
    if (score >= 70) return 'text-success';
    if (score >= 50) return 'text-warning';
    return 'text-error';
  };

  const getScoreBgClass = (score) => {
    if (score >= 70) return 'bg-success';
    if (score >= 50) return 'bg-warning';
    return 'bg-error';
  };

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-text-primary text-2xl font-semibold">Analytics</h1>
        <p className="text-text-secondary text-sm mt-1 mb-6">
          Assessment performance and hiring insights.
        </p>

        {/* Controls row skeleton */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="h-10 w-48 bg-tertiary rounded-lg animate-pulse" />
          <div className="h-10 w-64 bg-tertiary rounded-lg animate-pulse" />
        </div>

        {/* Metrics Cards Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div
              key={idx}
              className="bg-secondary border border-border-default rounded-xl p-5 animate-pulse min-h-27.5 flex flex-col justify-between"
            >
              <div className="h-4 w-24 bg-tertiary rounded" />
              <div className="h-8 w-16 bg-tertiary rounded mt-2" />
              <div className="h-3 w-32 bg-tertiary rounded mt-2" />
            </div>
          ))}
        </div>

        {/* Charts Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div
              key={idx}
              className="bg-secondary border border-border-default rounded-xl p-5 animate-pulse min-h-75 flex flex-col justify-between"
            >
              <div>
                <div className="h-5 w-40 bg-tertiary rounded mb-3" />
                <div className="h-3.5 w-64 bg-tertiary rounded mb-6" />
              </div>
              <div className="h-40 bg-tertiary/50 rounded-lg w-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-text-primary text-2xl font-semibold">Analytics</h1>
      <p className="text-text-secondary text-sm mt-1 mb-6">
        Assessment performance and hiring insights.
      </p>

      {error && (
        <div className="mb-6 flex items-center gap-3 rounded-lg border border-error/25 bg-error/15 px-4 py-3 text-sm text-error">
          <span>{error}</span>
        </div>
      )}

      {/* Controls row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        {/* Job selector dropdown */}
        <div>
          <select
            value={selectedJob}
            onChange={(e) => setSelectedJob(e.target.value)}
            className="bg-tertiary border border-border-default rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50 cursor-pointer"
          >
            <option value="all">All Jobs</option>
            {jobs.map((job) => (
              <option key={job.id} value={job.id}>
                {job.title}
              </option>
            ))}
          </select>
        </div>

        {/* Date range selector */}
        <div className="flex items-center bg-tertiary border border-border-default rounded-lg p-1">
          {[
            { label: '7d', value: '7d' },
            { label: '30d', value: '30d' },
            { label: '90d', value: '90d' },
            { label: 'All', value: 'all' },
          ].map((range) => {
            const isActive = dateRange === range.value;
            return (
              <button
                key={range.value}
                onClick={() => setDateRange(range.value)}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-accent text-white shadow-sm font-semibold'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
                type="button"
              >
                {range.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Metrics Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {/* Completion Rate */}
        <div className="bg-secondary border border-border-default rounded-xl p-5 flex flex-col justify-between">
          <div>
            <p className="text-text-secondary text-sm">Completion Rate</p>
            <p className="font-mono text-3xl font-bold text-text-primary mt-2">
              {hasNoCompleted ? '—' : `${completionRate}%`}
            </p>
          </div>
          <p className="text-text-tertiary text-xs mt-3">completed / started</p>
        </div>

        {/* Pass Rate */}
        <div className="bg-secondary border border-border-default rounded-xl p-5 flex flex-col justify-between">
          <div>
            <p className="text-text-secondary text-sm">Pass Rate</p>
            <p className="font-mono text-3xl font-bold text-text-primary mt-2">
              {hasNoCompleted ? '—' : `${passRate}%`}
            </p>
          </div>
          <p className="text-text-tertiary text-xs mt-3">passed / completed</p>
        </div>

        {/* Average Score */}
        <div className="bg-secondary border border-border-default rounded-xl p-5 flex flex-col justify-between">
          <div>
            <p className="text-text-secondary text-sm">Avg Score</p>
            <p className="font-mono text-3xl font-bold text-text-primary mt-2">
              {hasNoCompleted || avgScore === null ? '—' : avgScore}
            </p>
          </div>
          <div className="h-4 mt-3" />
        </div>

        {/* Link Open Rate */}
        <div className="bg-secondary border border-border-default rounded-xl p-5 flex flex-col justify-between">
          <div>
            <p className="text-text-secondary text-sm">Link Open Rate</p>
            <p className="font-mono text-3xl font-bold text-text-primary mt-2">
              {analytics.linkOpenRate !== null ? `${analytics.linkOpenRate}%` : '—'}
            </p>
          </div>
          <div className="mt-3">
            {analytics.linkOpenRate === null && (
              <span className="text-text-tertiary text-xs">Requires redirect tracking</span>
            )}
          </div>
        </div>
      </div>

      {/* Main content grid */}
      {hasNoCompleted ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Assessment Funnel Card */}
          <div className="bg-secondary border border-border-default rounded-xl p-5">
            <h2 className="text-text-primary font-semibold mb-4">Assessment Funnel</h2>
            <div className="space-y-4">
              {/* Opened Link */}
              <div className="w-full">
                <div className="flex justify-between items-center mb-1 text-sm">
                  <span className="text-text-tertiary">Opened Link</span>
                  <span className="font-mono text-text-tertiary">
                    {analytics.funnel.opened !== null ? analytics.funnel.opened : '—'}{' '}
                    {analytics.funnel.opened === null && (
                      <span className="text-text-tertiary text-xs">(redirect tracking required)</span>
                    )}
                  </span>
                </div>
                <div className="h-6 w-full bg-accent/20 rounded-lg overflow-hidden relative">
                  <div
                    className="h-full bg-accent"
                    style={{ width: `${analytics.funnel.opened !== null ? 100 : 0}%` }}
                  />
                </div>
              </div>

              {/* Started */}
              <div className="w-[85%]">
                <div className="flex justify-between items-center mb-1 text-sm">
                  <span className="text-text-secondary">Started</span>
                  <span className="font-mono text-text-primary">0</span>
                </div>
                <div className="h-6 w-full bg-accent/20 rounded-lg overflow-hidden">
                  <div className="h-full bg-accent w-0" />
                </div>
              </div>

              {/* Completed */}
              <div className="w-[70%]">
                <div className="flex justify-between items-center mb-1 text-sm">
                  <span className="text-text-secondary">Completed</span>
                  <span className="font-mono text-text-primary">0</span>
                </div>
                <div className="h-6 w-full bg-accent/20 rounded-lg overflow-hidden">
                  <div className="h-full bg-accent w-0" />
                </div>
              </div>

              {/* Passed */}
              <div className="w-[55%]">
                <div className="flex justify-between items-center mb-1 text-sm">
                  <span className="text-text-secondary">Passed</span>
                  <span className="font-mono text-text-primary">0</span>
                </div>
                <div className="h-6 w-full bg-accent/20 rounded-lg overflow-hidden">
                  <div className="h-full bg-accent w-0" />
                </div>
              </div>
            </div>
          </div>

          {/* Overall Empty State */}
          <div className="bg-secondary border border-border-default rounded-xl p-5 flex flex-col items-center justify-center min-h-75 text-center">
            <svg
              className="h-12 w-12 text-text-tertiary mb-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0 0 20.25 18V6A2.25 2.25 0 0 0 18 3.75H6A2.25 2.25 0 0 0 3.75 6v12A2.25 2.25 0 0 0 6 20.25Z"
              />
            </svg>
            <p className="text-text-secondary text-sm">
              Complete assessments will appear here once candidates start
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Row 1: Score Distribution + Completion Trend */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Score Distribution */}
            <div className="bg-secondary border border-border-default rounded-xl p-5 flex flex-col justify-between">
              <h2 className="text-text-primary font-semibold mb-4">Score Distribution</h2>
              {scoreDistribution.every((d) => d.count === 0) ? (
                <div className="flex items-center justify-center h-50">
                  <p className="text-text-tertiary text-sm">No score data yet</p>
                </div>
              ) : (
                <div className="h-50 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={scoreDistribution}>
                      <XAxis dataKey="range" tick={{ fill: 'var(--color-text-secondary)', fontSize: 11 }} />
                      <YAxis tick={{ fill: 'var(--color-text-secondary)', fontSize: 11 }} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{
                          background: 'var(--color-secondary)',
                          border: '1px solid var(--color-border-default)',
                          borderRadius: 8,
                        }}
                        labelStyle={{ color: 'var(--color-text-primary)' }}
                        itemStyle={{ color: 'var(--color-text-secondary)' }}
                      />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        {scoreDistribution.map((entry, index) => (
                          <Cell
                            key={index}
                            fill={
                              entry.range.startsWith('7') ||
                              entry.range.startsWith('8') ||
                              entry.range.startsWith('9')
                                ? 'var(--color-success)'
                                : entry.range.startsWith('5') ||
                                  entry.range.startsWith('6')
                                ? 'var(--color-warning)'
                                : 'var(--color-accent)'
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Completion Trend */}
            <div className="bg-secondary border border-border-default rounded-xl p-5 flex flex-col justify-between">
              <h2 className="text-text-primary font-semibold mb-4">Completion Trend</h2>
              {completionTrend.length === 0 || completionTrend.every((d) => d.count === 0) ? (
                <div className="flex items-center justify-center h-50">
                  <p className="text-text-tertiary text-sm">No completions in this date range</p>
                </div>
              ) : (
                <div className="h-50 w-full">
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={completionTrend}>
                      <XAxis dataKey="date" tick={{ fill: 'var(--color-text-secondary)', fontSize: 11 }} />
                      <YAxis tick={{ fill: 'var(--color-text-secondary)', fontSize: 11 }} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{
                          background: 'var(--color-secondary)',
                          border: '1px solid var(--color-border-default)',
                          borderRadius: 8,
                        }}
                        labelStyle={{ color: 'var(--color-text-primary)' }}
                        itemStyle={{ color: 'var(--color-text-secondary)' }}
                      />
                      <Line
                        type="monotone"
                        dataKey="count"
                        stroke="var(--color-accent)"
                        strokeWidth={2}
                        dot={{ fill: 'var(--color-accent)', r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          {/* Row 2: Funnel + Missed Skills */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Assessment Funnel */}
            <div className="bg-secondary border border-border-default rounded-xl p-5">
              <h2 className="text-text-primary font-semibold mb-4">Assessment Funnel</h2>
              <div className="space-y-4">
                {/* Opened Link */}
                <div className="w-full">
                  <div className="flex justify-between items-center mb-1 text-sm">
                    <span className="text-text-tertiary">Opened Link</span>
                    <span className="font-mono text-text-tertiary">
                      {analytics.funnel.opened !== null ? analytics.funnel.opened : '—'}{' '}
                      {analytics.funnel.opened === null && (
                        <span className="text-text-tertiary text-xs">(redirect tracking required)</span>
                      )}
                    </span>
                  </div>
                  <div className="h-6 w-full bg-accent/20 rounded-lg overflow-hidden relative">
                    <div
                      className="h-full bg-accent"
                      style={{ width: `${analytics.funnel.opened !== null ? 100 : 0}%` }}
                    />
                  </div>
                </div>

                {/* Started */}
                <div className="w-[85%]">
                  <div className="flex justify-between items-center mb-1 text-sm">
                    <span className="text-text-secondary">Started</span>
                    <span className="font-mono text-text-primary font-bold">{funnel.started}</span>
                  </div>
                  <div className="h-6 w-full bg-accent/20 rounded-lg overflow-hidden">
                    <div className="h-full bg-accent rounded-lg" style={{ width: '100%' }} />
                  </div>
                </div>

                {/* Completed */}
                <div className="w-[70%]">
                  <div className="flex justify-between items-center mb-1 text-sm">
                    <span className="text-text-secondary">Completed</span>
                    <span className="font-mono text-text-primary font-bold">{funnel.completed}</span>
                  </div>
                  <div className="h-6 w-full bg-accent/20 rounded-lg overflow-hidden">
                    <div
                      className="h-full bg-accent rounded-lg"
                      style={{
                        width: `${funnel.started > 0 ? (funnel.completed / funnel.started) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Passed */}
                <div className="w-[55%]">
                  <div className="flex justify-between items-center mb-1 text-sm">
                    <span className="text-text-secondary">Passed</span>
                    <span className="font-mono text-text-primary font-bold">{funnel.passed}</span>
                  </div>
                  <div className="h-6 w-full bg-accent/20 rounded-lg overflow-hidden">
                    <div
                      className="h-full bg-accent rounded-lg"
                      style={{
                        width: `${funnel.started > 0 ? (funnel.passed / funnel.started) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Most Missed Skills */}
            <div className="bg-secondary border border-border-default rounded-xl p-5 flex flex-col justify-between">
              <div>
                <h2 className="text-text-primary font-semibold">Most Missed Skills</h2>
                <p className="text-text-tertiary text-xs mb-4 mt-1">
                  Skills with lowest average scores across all candidates
                </p>
                {missedSkills.length === 0 ? (
                  <div className="flex items-center justify-center h-40">
                    <p className="text-text-tertiary text-sm">Not enough data yet</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {missedSkills.map((skill) => (
                      <div key={skill.skill} className="space-y-1.5">
                        <div className="flex justify-between items-center">
                          <span className="text-text-primary text-sm font-medium">{skill.skill}</span>
                          <span className={`font-mono text-sm font-semibold ${getScoreTextClass(skill.avgScore)}`}>
                            {skill.avgScore}%
                          </span>
                        </div>
                        <div className="w-full bg-tertiary rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${getScoreBgClass(skill.avgScore)}`}
                            style={{ width: `${skill.avgScore}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RecruiterAnalytics;
