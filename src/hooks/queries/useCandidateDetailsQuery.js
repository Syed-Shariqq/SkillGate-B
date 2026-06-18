import { useQuery } from "@tanstack/react-query";
import { getCandidateProfile } from "@/services/recruiter/candidateService";

export const useCandidateDetailsQuery = (candidateId, recruiterId) => {
  return useQuery({
    queryKey: ["candidate", candidateId],
    queryFn: async () => {
      const { data, error } = await getCandidateProfile(candidateId, recruiterId);
      if (error) throw error;
      return data;
    },
    staleTime: 60 * 1000, // 60 seconds
    enabled: !!candidateId && !!recruiterId,
  });
};
