import { useQuery } from "@tanstack/react-query";
import { getJobsList } from "@/services/recruiter/analyticsService";

export const useAnalyticsJobsQuery = (recruiterId) => {
  return useQuery({
    queryKey: ["analytics-jobs", recruiterId],
    queryFn: async () => {
      const { data, error } = await getJobsList(recruiterId);
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!recruiterId,
  });
};
