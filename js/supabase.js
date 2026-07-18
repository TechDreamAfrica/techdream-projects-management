// ============================================================================
// Supabase Client — single source of truth for the connection.
// Replace the two constants below with your project's values
// (Supabase Dashboard → Project Settings → API).
// ============================================================================
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

export const SUPABASE_URL = 'https://wdakzfhlehjhwderhrnw.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_03HZh1Ge8mUK1ElDQ96aRg_bDysDXjc';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

// Convenience: fetch the current session's user profile row (public.users).
export async function getCurrentProfile() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single();
  if (error) {
    console.error('getCurrentProfile error', error);
    return null;
  }
  return data;
}

// Guard used at the top of every protected page.
// Redirects to login.html if there is no active session.
export async function requireAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.href = 'login.html';
    return null;
  }
  return session;
}

// Redirects staff/clients to the dashboard variant appropriate for their role.
export function dashboardUrlForRole(role) {
  switch (role) {
    case 'developer': return 'dashboard.html?view=developer';
    case 'project_manager': return 'dashboard.html?view=pm';
    case 'admin': return 'dashboard.html?view=admin';
    default: return 'dashboard.html?view=client';
  }
}
