import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getRecentNotifications,
  getAllNotifications,
  markAllAsRead,
  markOneAsRead,
} from "@/services/recruiter/notificationService";
import { supabase } from "@/config/supabase";

export const useAllNotificationsQuery = (recruiterId) => {
  return useQuery({
    queryKey: ["notifications", recruiterId, "all"],
    queryFn: async () => {
      const { data, error } = await getAllNotifications(recruiterId);
      if (error) throw error;
      return data || [];
    },
    staleTime: 15 * 1000, // 15 seconds
    enabled: !!recruiterId,
  });
};

export const useRecentNotificationsQuery = (recruiterId) => {
  return useQuery({
    queryKey: ["notifications", recruiterId, "recent"],
    queryFn: async () => {
      const { data, error } = await getRecentNotifications(recruiterId);
      if (error) throw error;
      return data || [];
    },
    staleTime: 15 * 1000, // 15 seconds
    enabled: !!recruiterId,
  });
};

export const useUnreadNotificationsCountQuery = (recruiterId) => {
  return useQuery({
    queryKey: ["notifications", recruiterId, "unread-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("recruiter_id", recruiterId)
        .eq("is_read", false);
      if (error) throw error;
      return count || 0;
    },
    staleTime: 15 * 1000, // 15 seconds
    enabled: !!recruiterId,
  });
};

export const useFailedEmailNotificationsCountQuery = (recruiterId) => {
  return useQuery({
    queryKey: ["notifications", recruiterId, "failed-email-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("recruiter_id", recruiterId)
        .eq("type", "email_failed")
        .eq("is_read", false);
      if (error) throw error;
      return count || 0;
    },
    staleTime: 15 * 1000, // 15 seconds
    enabled: !!recruiterId,
  });
};

export const useMarkAllNotificationsReadMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ recruiterId }) => {
      const { error } = await markAllAsRead(recruiterId);
      if (error) throw error;
      return { recruiterId };
    },
    onMutate: async ({ recruiterId }) => {
      await queryClient.cancelQueries({ queryKey: ["notifications", recruiterId] });

      const previousAll = queryClient.getQueryData(["notifications", recruiterId, "all"]);
      const previousRecent = queryClient.getQueryData(["notifications", recruiterId, "recent"]);
      const previousCount = queryClient.getQueryData(["notifications", recruiterId, "unread-count"]);
      const previousFailedCount = queryClient.getQueryData(["notifications", recruiterId, "failed-email-count"]);

      // Optimistically set all as read
      if (previousAll) {
        queryClient.setQueryData(
          ["notifications", recruiterId, "all"],
          previousAll.map((n) => ({ ...n, is_read: true }))
        );
      }
      if (previousRecent) {
        queryClient.setQueryData(
          ["notifications", recruiterId, "recent"],
          previousRecent.map((n) => ({ ...n, is_read: true }))
        );
      }
      queryClient.setQueryData(["notifications", recruiterId, "unread-count"], 0);
      queryClient.setQueryData(["notifications", recruiterId, "failed-email-count"], 0);

      return { previousAll, previousRecent, previousCount, previousFailedCount };
    },
    onError: (err, variables, context) => {
      if (context) {
        queryClient.setQueryData(
          ["notifications", variables.recruiterId, "all"],
          context.previousAll
        );
        queryClient.setQueryData(
          ["notifications", variables.recruiterId, "recent"],
          context.previousRecent
        );
        queryClient.setQueryData(
          ["notifications", variables.recruiterId, "unread-count"],
          context.previousCount
        );
        queryClient.setQueryData(
          ["notifications", variables.recruiterId, "failed-email-count"],
          context.previousFailedCount
        );
      }
    },
    onSettled: (data, error, variables) => {
      queryClient.invalidateQueries({ queryKey: ["notifications", variables.recruiterId] });
    },
  });
};

export const useMarkOneNotificationReadMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ notificationId, recruiterId }) => {
      const { error } = await markOneAsRead(notificationId);
      if (error) throw error;
      return { notificationId, recruiterId };
    },
    onMutate: async ({ notificationId, recruiterId }) => {
      await queryClient.cancelQueries({ queryKey: ["notifications", recruiterId] });

      const previousAll = queryClient.getQueryData(["notifications", recruiterId, "all"]);
      const previousRecent = queryClient.getQueryData(["notifications", recruiterId, "recent"]);
      const previousCount = queryClient.getQueryData(["notifications", recruiterId, "unread-count"]);
      const previousFailedCount = queryClient.getQueryData(["notifications", recruiterId, "failed-email-count"]);

      let targetNotif = null;
      if (previousAll) {
        targetNotif = previousAll.find((n) => n.id === notificationId);
        queryClient.setQueryData(
          ["notifications", recruiterId, "all"],
          previousAll.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n))
        );
      }
      if (previousRecent) {
        if (!targetNotif) {
          targetNotif = previousRecent.find((n) => n.id === notificationId);
        }
        queryClient.setQueryData(
          ["notifications", recruiterId, "recent"],
          previousRecent.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n))
        );
      }
      if (typeof previousCount === "number") {
        queryClient.setQueryData(
          ["notifications", recruiterId, "unread-count"],
          Math.max(0, previousCount - 1)
        );
      }
      if (targetNotif?.type === "email_failed" && typeof previousFailedCount === "number") {
        queryClient.setQueryData(
          ["notifications", recruiterId, "failed-email-count"],
          Math.max(0, previousFailedCount - 1)
        );
      }

      return { previousAll, previousRecent, previousCount, previousFailedCount };
    },
    onError: (err, variables, context) => {
      if (context) {
        queryClient.setQueryData(
          ["notifications", variables.recruiterId, "all"],
          context.previousAll
        );
        queryClient.setQueryData(
          ["notifications", variables.recruiterId, "recent"],
          context.previousRecent
        );
        queryClient.setQueryData(
          ["notifications", variables.recruiterId, "unread-count"],
          context.previousCount
        );
        queryClient.setQueryData(
          ["notifications", variables.recruiterId, "failed-email-count"],
          context.previousFailedCount
        );
      }
    },
    onSettled: (data, error, variables) => {
      queryClient.invalidateQueries({ queryKey: ["notifications", variables.recruiterId] });
    },
  });
};
