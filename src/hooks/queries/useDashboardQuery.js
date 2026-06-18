import { useQuery } from "@tanstack/react-query";
import {
  getDashboardStats,
  getRecentActivity,
  getRecentJobs,
} from "@/services/recruiter/dashboardService";

const readDashboardData = async (recruiterId) => {
  const [statsResult, activityResult, jobsResult] = await Promise.all([
    getDashboardStats(recruiterId),
    getRecentActivity(recruiterId),
    getRecentJobs(recruiterId),
  ]);

  const dashboardError = [statsResult, activityResult, jobsResult].find(
    (result) => result.error,
  )?.error;

  if (dashboardError) throw dashboardError;

  return {
    statsData: statsResult.data,
    activityData: activityResult.data,
    jobsData: jobsResult.data,
  };
};

export const useDashboardQuery = (recruiterId) => {
  return useQuery({
    queryKey: ["dashboard", recruiterId],
    queryFn: () => readDashboardData(recruiterId),
    staleTime: 30 * 1000, // 30 seconds
    enabled: !!recruiterId,
  });
};
