import { supabase } from "@/lib/supabase";

export const getRecentNotifications = async (uid) => {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('id, type, title, message, candidate_id, job_id, is_read, created_at')
      .eq('recruiter_id', uid)
      .order('created_at', { ascending: false })
      .limit(10);
    return { data, error };
  } catch (error) {
    return { data: null, error };
  }
};

export const getAllNotifications = async (uid) => {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('id, type, title, message, candidate_id, job_id, is_read, created_at')
      .eq('recruiter_id', uid)
      .order('created_at', { ascending: false });
    return { data, error };
  } catch (error) {
    return { data: null, error };
  }
};

export const markAllAsRead = async (uid) => {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('recruiter_id', uid)
      .eq('is_read', false);
    return { data, error };
  } catch (error) {
    return { data: null, error };
  }
};

export const markOneAsRead = async (notificationId) => {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId);
    return { data, error };
  } catch (error) {
    return { data: null, error };
  }
};
