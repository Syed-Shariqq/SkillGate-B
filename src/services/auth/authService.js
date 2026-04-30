import { supabase } from '../../config/supabase'

const PROFILE_SELECT =
  'id, full_name, company_name, company_website, work_email, is_onboarded'

export const register = ({ name, email, password }) => {
  return supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name,
      },
    },
  })
}

export const login = ({ email, password }) => {
  return supabase.auth.signInWithPassword({
    email,
    password,
  })
}

export const logout = () => {
  return supabase.auth.signOut()
}

export const getCurrentUser = async () => {
  const { data } = await supabase.auth.getUser()

  return data.user || null
}

export const getProfile = (userId) => {
  return supabase
    .from('profiles')
    .select(PROFILE_SELECT)
    .eq('id', userId)
    .single()
}

export const updateCompanyDetails = (
  userId,
  { company_name, company_website, work_email }
) => {
  return supabase
    .from('profiles')
    .update({
      company_name,
      company_website,
      work_email,
      is_onboarded: true,
    })
    .eq('id', userId)
    .select(PROFILE_SELECT)
    .single()
}
