import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getJobCandidates,
  updateCandidateStatus,
  bulkUpdateCandidateStatus,
} from "@/services/recruiter/jobsService";

export const useCandidatesQuery = (jobId, recruiterId) => {
  return useQuery({
    queryKey: ["candidates", jobId],
    queryFn: async () => {
      const { data, error } = await getJobCandidates(jobId, recruiterId);
      if (error) throw error;
      return data || [];
    },
    staleTime: 60 * 1000, // 60 seconds
    enabled: !!jobId && !!recruiterId,
  });
};

export const useUpdateCandidateStatusMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ candidateId, recruiterId, status, jobId }) => {
      const { error } = await updateCandidateStatus(candidateId, recruiterId, status);
      if (error) throw error;
      return { candidateId, recruiterId, status, jobId };
    },
    onMutate: async ({ candidateId, recruiterId, status, jobId }) => {
      await queryClient.cancelQueries({ queryKey: ["candidates", jobId] });
      await queryClient.cancelQueries({ queryKey: ["candidate", candidateId] });

      const previousCandidates = queryClient.getQueryData(["candidates", jobId]);
      const previousCandidateProfile = queryClient.getQueryData(["candidate", candidateId]);

      // Optimistically update candidates list
      if (previousCandidates) {
        queryClient.setQueryData(
          ["candidates", jobId],
          previousCandidates.map((c) =>
            c.id === candidateId
              ? {
                  ...c,
                  status,
                  shortlisted: status === "shortlisted",
                  rejected: status === "rejected",
                }
              : c
          )
        );
      }

      // Optimistically update candidate details
      if (previousCandidateProfile) {
        queryClient.setQueryData(["candidate", candidateId], {
          ...previousCandidateProfile,
          candidate: {
            ...previousCandidateProfile.candidate,
            status,
          },
        });
      }

      return { previousCandidates, previousCandidateProfile };
    },
    onError: (err, variables, context) => {
      if (context?.previousCandidates) {
        queryClient.setQueryData(["candidates", variables.jobId], context.previousCandidates);
      }
      if (context?.previousCandidateProfile) {
        queryClient.setQueryData(
          ["candidate", variables.candidateId],
          context.previousCandidateProfile
        );
      }
    },
    onSettled: (data, error, variables) => {
      queryClient.invalidateQueries({ queryKey: ["candidates", variables.jobId] });
      queryClient.invalidateQueries({ queryKey: ["candidate", variables.candidateId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard", variables.recruiterId] });
    },
  });
};

export const useBulkUpdateCandidateStatusMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ candidateIds, recruiterId, status, jobId }) => {
      const { error } = await bulkUpdateCandidateStatus(candidateIds, recruiterId, status);
      if (error) throw error;
      return { candidateIds, recruiterId, status, jobId };
    },
    onMutate: async ({ candidateIds, recruiterId, status, jobId }) => {
      await queryClient.cancelQueries({ queryKey: ["candidates", jobId] });

      const previousCandidates = queryClient.getQueryData(["candidates", jobId]);

      // Optimistically update candidate list
      if (previousCandidates) {
        queryClient.setQueryData(
          ["candidates", jobId],
          previousCandidates.map((c) =>
            candidateIds.includes(c.id)
              ? {
                  ...c,
                  status,
                  shortlisted: status === "shortlisted",
                  rejected: status === "rejected",
                }
              : c
          )
        );
      }

      return { previousCandidates };
    },
    onError: (err, variables, context) => {
      if (context?.previousCandidates) {
        queryClient.setQueryData(["candidates", variables.jobId], context.previousCandidates);
      }
    },
    onSettled: (data, error, variables) => {
      queryClient.invalidateQueries({ queryKey: ["candidates", variables.jobId] });
      if (variables.candidateIds) {
        variables.candidateIds.forEach((candidateId) => {
          queryClient.invalidateQueries({ queryKey: ["candidate", candidateId] });
        });
      }
      queryClient.invalidateQueries({ queryKey: ["dashboard", variables.recruiterId] });
    },
  });
};
