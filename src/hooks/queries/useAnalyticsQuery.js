import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { getAnalyticsData } from "@/services/recruiter/analyticsService";

export const useAnalyticsQuery = (recruiterId, selectedJob, dateRange) => {
  return useQuery({
    queryKey: ["analytics", recruiterId, selectedJob, dateRange],
    queryFn: async () => {
      const { data, error } = await getAnalyticsData(recruiterId, selectedJob, dateRange);
      if (error) throw error;
      return data || null;
    },
    staleTime: 60 * 1000, // 1 minute
    enabled: !!recruiterId,
    placeholderData: keepPreviousData,
  });
};
