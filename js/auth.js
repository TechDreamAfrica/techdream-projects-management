// ============================================================================
// Authentication — registration, login, logout, password reset, session.
// ============================================================================
import { supabase, dashboardUrlForRole } from './supabase.js';
import { toast } from './ui.js';

// ---------------------------------------------------------------- Register --
export async function registerUser({ fullname, email, password, company, role = 'client' }) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { fullname, company, role },
      emailRedirectTo: `${window.location.origin}/login.html?verified=1`,
    },
  });
  if (error) throw error;
  return data;
}

// ------------------------------------------------------------------- Login --
export async function loginUser({ email, password, rememberMe }) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;

  // "Remember me" — Supabase persists sessions to localStorage by default.
  // When unchecked, we mirror the session into sessionStorage instead so it
  // clears when the browser closes.
  if (!rememberMe) {
    localStorage.setItem('tda-session-scope', 'tab');
  } else {
    localStorage.removeItem('tda-session-scope');
  }

  const { data: profile } = await supabase.from('users').select('role').eq('id', data.user.id).single();
  return { session: data.session, role: profile?.role || 'client' };
}

// ------------------------------------------------------------------ Logout --
export async function logoutUser() {
  await supabase.auth.signOut();
  window.location.href = 'index.html';
}

// --------------------------------------------------------- Password reset --
export async function requestPasswordReset(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password.html`,
  });
  if (error) throw error;
}

export async function updatePassword(newPassword) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

// -------------------------------------------------------------- Profile ----
export async function updateProfile(userId, updates) {
  const { error } = await supabase.from('users').update(updates).eq('id', userId);
  if (error) throw error;
}

// ---------------------------------------------------------- Session watch --
// Call once per page (after DOM ready) to keep the navbar / redirects in
// sync with auth state changes across tabs.
export function watchSession(onChange) {
  supabase.auth.onAuthStateChange((event, session) => {
    onChange?.(event, session);
  });
}

// ------------------------------------------------------- Form wiring utils -
export function wireRegisterForm(formEl) {
  formEl.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = formEl.querySelector('[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.dataset.originalText = submitBtn.textContent;
    submitBtn.textContent = 'Creating account…';
    try {
      const fd = new FormData(formEl);
      const password = fd.get('password');
      const confirm = fd.get('confirm_password');
      if (password !== confirm) throw new Error('Passwords do not match.');
      if (password.length < 8) throw new Error('Password must be at least 8 characters.');

      await registerUser({
        fullname: fd.get('fullname'),
        email: fd.get('email'),
        password,
        company: fd.get('company') || null,
        role: fd.get('role') || 'client',
      });
      toast('Account created! Check your email to verify your address.', 'success', 6000);
      setTimeout(() => (window.location.href = 'login.html'), 1500);
    } catch (err) {
      toast(err.message || 'Registration failed.', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = submitBtn.dataset.originalText;
    }
  });
}

export function wireLoginForm(formEl) {
  formEl.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = formEl.querySelector('[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.dataset.originalText = submitBtn.textContent;
    submitBtn.textContent = 'Signing in…';
    try {
      const fd = new FormData(formEl);
      const { role } = await loginUser({
        email: fd.get('email'),
        password: fd.get('password'),
        rememberMe: fd.get('remember_me') === 'on',
      });
      toast('Welcome back!', 'success');
      setTimeout(() => (window.location.href = dashboardUrlForRole(role)), 600);
    } catch (err) {
      toast(err.message || 'Login failed. Check your credentials.', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = submitBtn.dataset.originalText;
    }
  });
}
