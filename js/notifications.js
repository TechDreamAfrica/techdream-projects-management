// ============================================================================
// Notifications — bell dropdown, unread counter, realtime push.
// ============================================================================
import { supabase } from './supabase.js';
import { timeAgo } from './ui.js';

export async function getNotifications(limit = 20) {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

export async function getUnreadCount() {
  const { data: { user } } = await supabase.auth.getUser();
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('read', false);
  if (error) throw error;
  return count || 0;
}

export async function markAllRead() {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false);
  if (error) throw error;
}

export async function markOneRead(id) {
  const { error } = await supabase.from('notifications').update({ read: true }).eq('id', id);
  if (error) throw error;
}

const NOTIF_ICON = {
  project_submitted: '📥', project_approved: '✅', new_message: '💬',
  file_uploaded: '📎', milestone_complete: '🏁', deadline_reminder: '⏰',
  deployment_complete: '🚀', general: '🔔',
};

export function renderNotificationItem(n) {
  return `
    <a href="${n.link || '#'}" data-notif-id="${n.id}"
       class="flex gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ${n.read ? 'opacity-60' : ''}">
      <span class="text-lg">${NOTIF_ICON[n.type] || NOTIF_ICON.general}</span>
      <div class="min-w-0 flex-1">
        <p class="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">${n.title}</p>
        ${n.message ? `<p class="text-xs text-slate-500 dark:text-slate-400 truncate">${n.message}</p>` : ''}
        <p class="text-[11px] text-slate-400 mt-0.5">${timeAgo(n.created_at)}</p>
      </div>
      ${!n.read ? '<span class="mt-1 h-2 w-2 rounded-full bg-blue-600 shrink-0"></span>' : ''}
    </a>
  `;
}

// Wires the bell icon: loads recent notifications, keeps the unread badge
// live via Realtime, and marks-as-read on click.
export async function initNotificationBell({ bellBtn, panelEl, badgeEl, listEl }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const refresh = async () => {
    const [items, unread] = await Promise.all([getNotifications(), getUnreadCount()]);
    listEl.innerHTML = items.length
      ? items.map(renderNotificationItem).join('')
      : '<p class="text-sm text-slate-400 text-center py-8">No notifications yet.</p>';
    badgeEl.textContent = unread > 9 ? '9+' : String(unread);
    badgeEl.classList.toggle('hidden', unread === 0);
  };

  bellBtn.addEventListener('click', () => {
    panelEl.classList.toggle('hidden');
    if (!panelEl.classList.contains('hidden')) refresh();
  });

  listEl.addEventListener('click', async (e) => {
    const item = e.target.closest('[data-notif-id]');
    if (item) await markOneRead(item.dataset.notifId);
  });

  document.addEventListener('click', (e) => {
    if (!panelEl.contains(e.target) && !bellBtn.contains(e.target)) panelEl.classList.add('hidden');
  });

  supabase
    .channel(`notifications:${user.id}`)
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
      () => refresh()
    )
    .subscribe();

  await refresh();
}
