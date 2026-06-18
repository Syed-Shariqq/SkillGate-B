import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAllJobs, toggleJobActive } from "@/services/recruiter/jobsService";

export const useJobsQuery = (recruiterId) => {
  return useQuery({
    queryKey: ["jobs", recruiterId],
    queryFn: async () => {
      const { data, error } = await getAllJobs(recruiterId);
      if (error) throw error;
      return data || [];
    },
    staleTime: 60 * 1000, // 60 seconds
    enabled: !!recruiterId,
  });
};

export const useToggleJobActiveMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ jobId, recruiterId, isActive }) => {
      const { error } = await toggleJobActive(jobId, recruiterId, isActive);
      if (error) throw error;
      return { jobId, recruiterId, isActive };
    },
    onMutate: async ({ jobId, recruiterId, isActive }) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: ["jobs", recruiterId] });
      await queryClient.cancelQueries({ queryKey: ["job", jobId] });

      // Snapshot previous values
      const previousJobs = queryClient.getQueryData(["jobs", recruiterId]);
      const previousJobDetails = queryClient.getQueryData(["job", jobId]);

      // Optimistically update jobs list
      if (previousJobs) {
        queryClient.setQueryData(
          ["jobs", recruiterId],
          previousJobs.map((job) =>
            job.id === jobId ? { ...job, is_active: isActive } : job
          )
        );
      }

      // Optimistically update job details
      if (previousJobDetails) {
        queryClient.setQueryData(["job", jobId], {
          ...previousJobDetails,
          is_active: isActive,
        });
      }

      return { previousJobs, previousJobDetails };
    },
    onError: (err, variables, context) => {
      if (context?.previousJobs) {
        queryClient.setQueryData(
          ["jobs", variables.recruiterId],
          context.previousJobs
        );
      }
      if (context?.previousJobDetails) {
        queryClient.setQueryData(["job", variables.jobId], context.previousJobDetails);
      }
    },
    onSettled: (data, error, variables) => {
      queryClient.invalidateQueries({ queryKey: ["jobs", variables.recruiterId] });
    },
  });
};
