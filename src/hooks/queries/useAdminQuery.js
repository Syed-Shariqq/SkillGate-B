import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getPendingAccounts,
  approveAccount,
  rejectAccount,
} from "@/services/recruiter/adminService";

export const usePendingAccountsQuery = (options = {}) => {
  return useQuery({
    queryKey: ["admin", "pending_accounts"],
    queryFn: async () => {
      const { data, error } = await getPendingAccounts();
      if (error) throw error;
      return data || [];
    },
    staleTime: 30 * 1000, // 30 seconds
    ...options,
  });
};

export const useApproveAccountMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (profileId) => {
      const { data, error } = await approveAccount(profileId);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "pending_accounts"] });
    },
  });
};

export const useRejectAccountMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (profileId) => {
      const { data, error } = await rejectAccount(profileId);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "pending_accounts"] });
    },
  });
};
