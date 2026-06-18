import { useQuery } from "@tanstack/react-query";
import { getOnboardingStatus } from "@/services/recruiter/dashboardService";

export const useOnboardingStatusQuery = (recruiterId) => {
  return useQuery({
    queryKey: ["onboarding", recruiterId],
    queryFn: async () => {
      const onboardingStatusResult = await getOnboardingStatus(recruiterId);

      if (onboardingStatusResult.error) {
        throw onboardingStatusResult.error;
      }

      const { onboardingResult, profileResult, jobsResult } = onboardingStatusResult.data || {};

      if (onboardingResult?.error) throw onboardingResult.error;
      if (profileResult?.error) throw profileResult.error;
      if (jobsResult?.error) throw jobsResult.error;

      const onboardingComplete = onboardingResult?.data?.onboarding_complete || false;
      const hasCompanyDetails =
        Boolean(profileResult?.data?.company_name) &&
        Boolean(profileResult?.data?.company_website);
      const hasFirstJob = (jobsResult?.count || 0) > 0;

      return {
        onboardingComplete,
        companyDetailsComplete: hasCompanyDetails,
        firstJobComplete: hasFirstJob,
      };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!recruiterId,
  });
};
