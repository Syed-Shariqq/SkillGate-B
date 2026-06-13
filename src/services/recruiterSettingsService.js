import { supabase } from "../lib/supabase";

export const getRecruiterProfile = async (uid) => {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select(`
        id, email, full_name, company_name, company_website,
        company_logo_url, work_email,
        notify_on_every_completion, notify_on_pass_only, notify_inapp
      `)
      .eq("id", uid)
      .maybeSingle();

    return { data, error };
  } catch (error) {
    return { data: null, error };
  }
};

export const updateAccountSettings = async (uid, updates) => {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", uid)
      .select();

    return { data, error };
  } catch (error) {
    return { data: null, error };
  }
};

export const updateCompanySettings = async (uid, updates) => {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", uid)
      .select();

    return { data, error };
  } catch (error) {
    return { data: null, error };
  }
};

export const updateNotificationSettings = async (uid, updates) => {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", uid)
      .select();

    return { data, error };
  } catch (error) {
    return { data: null, error };
  }
};

export const updatePassword = async (newPassword) => {
  try {
    const { data, error } = await supabase.auth.updateUser({ password: newPassword });
    return { data, error };
  } catch (error) {
    return { data: null, error };
  }
};

export const uploadCompanyLogo = async (uid, file) => {
  try {
    const fileExt = file.name.split(".").pop();
    const path = `${uid}/company-logo-${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("logos")
      .upload(path, file, { upsert: true });

    if (uploadError) {
      return { data: null, error: uploadError };
    }

    const { data: { publicUrl } } = supabase.storage
      .from("logos")
      .getPublicUrl(path);

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ company_logo_url: publicUrl })
      .eq("id", uid);

    return { data: { publicUrl }, error: updateError };
  } catch (error) {
    return { data: null, error };
  }
};

export const deleteAccount = async (uid) => {
  return {
    data: null,
    error: { message: "Account deletion requires contacting support at support@skillgate.app" },
  };
};
