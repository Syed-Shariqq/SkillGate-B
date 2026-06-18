import { useQuery } from "@tanstack/react-query";
import { getJobById } from "@/services/recruiter/jobsService";

export const useJobDetailsQuery = (jobId, recruiterId) => {
  return useQuery({
    queryKey: ["job", jobId],
    queryFn: async () => {
      const { data, error } = await getJobById(jobId, recruiterId);
      if (error) throw error;
      return data;
    },
    staleTime: 60 * 1000, // 60 seconds
    enabled: !!jobId && !!recruiterId,
  });
};
