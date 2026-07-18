// ============================================================================
// Dashboard — role-aware stats, recent activity, quick actions.
// ============================================================================
import { supabase, getCurrentProfile } from './supabase.js';
import { getMyProjects, statusLabel } from './projects.js';
import { skeletonRows, emptyState, timeAgo } from './ui.js';

const STATUS_COLORS = {
  submitted: 'bg-slate-100 text-slate-600',
  requirement_review: 'bg-amber-100 text-amber-700',
  approved: 'bg-blue-100 text-blue-700',
  design: 'bg-violet-100 text-violet-700',
  development: 'bg-teal-100 text-teal-700',
  testing: 'bg-orange-100 text-orange-700',
  client_review: 'bg-amber-100 text-amber-700',
  revision: 'bg-red-100 text-red-700',
  deployment: 'bg-blue-100 text-blue-700',
  completed: 'bg-emerald-100 text-emerald-700',
};

export function statusBadge(status) {
  const cls = STATUS_COLORS[status] || 'bg-slate-100 text-slate-600';
  return `<span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${cls}">${statusLabel(status)}</span>`;
}

export async function renderClientDashboard({ statsRow, activityList, projectsGrid }) {
  const projects = await getMyProjects();

  statsRow.innerHTML = [
    { label: 'Active Projects', value: projects.filter(p => !['completed', 'cancelled'].includes(p.status)).length, color: 'text-teal-700', icon: '📁' },
    { label: 'Pending Requests', value: projects.filter(p => ['submitted', 'requirement_review'].includes(p.status)).length, color: 'text-amber-600', icon: '⏳' },
    { label: 'Completed', value: projects.filter(p => p.status === 'completed').length, color: 'text-emerald-600', icon: '✅' },
    { label: 'Total Projects', value: projects.length, color: 'text-blue-600', icon: '📊' },
  ].map(s => `
    <div class="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm hover:shadow-md transition-shadow">
      <div class="flex items-center justify-between">
        <p class="text-sm text-slate-500 dark:text-slate-400">${s.label}</p>
        <span class="text-lg">${s.icon}</span>
      </div>
      <p class="mt-2 text-3xl font-semibold ${s.color}">${s.value}</p>
    </div>
  `).join('');

  if (!projects.length) {
    projectsGrid.innerHTML = emptyState({
      icon: '🚀', title: 'No projects yet',
      subtitle: 'Start by telling us about the software you want to build.',
      actionLabel: 'Request a Project', actionHref: 'new-project.html',
    });
    activityList.innerHTML = '<p class="text-sm text-slate-400 text-center py-6">Nothing to show yet.</p>';
    return;
  }

  projectsGrid.innerHTML = projects.slice(0, 6).map(p => `
    <a href="project.html?id=${p.id}" class="block rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
      <div class="flex items-start justify-between gap-2">
        <h3 class="font-semibold text-slate-800 dark:text-slate-100 truncate">${p.title}</h3>
        ${statusBadge(p.status)}
      </div>
      <p class="text-sm text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">${p.description || 'No description provided.'}</p>
      <div class="mt-4">
        <div class="flex justify-between text-xs text-slate-400 mb-1">
          <span>Progress</span><span>${p.progress}%</span>
        </div>
        <div class="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
          <div class="h-full bg-gradient-to-r from-teal-600 to-blue-600 rounded-full transition-all" style="width:${p.progress}%"></div>
        </div>
      </div>
    </a>
  `).join('');

  activityList.innerHTML = projects.slice(0, 5).map(p => `
    <div class="flex items-center gap-3 py-3 border-b border-slate-100 dark:border-slate-800 last:border-0">
      <span class="h-8 w-8 shrink-0 rounded-full bg-teal-50 dark:bg-teal-950 flex items-center justify-center text-teal-700 text-sm font-semibold">${p.title[0]}</span>
      <div class="min-w-0 flex-1">
        <p class="text-sm text-slate-700 dark:text-slate-200 truncate"><strong>${p.title}</strong> is now <em>${statusLabel(p.status)}</em></p>
        <p class="text-xs text-slate-400">${timeAgo(p.updated_at || p.created_at)}</p>
      </div>
    </div>
  `).join('');
}

export async function renderStaffDashboard({ statsRow, projectsTableBody }, roleFilter) {
  const profile = await getCurrentProfile();
  const projects = await getMyProjects();

  statsRow.innerHTML = [
    { label: 'Total Projects', value: projects.length, icon: '📁' },
    { label: 'In Development', value: projects.filter(p => p.status === 'development').length, icon: '🛠️' },
    { label: 'Awaiting Review', value: projects.filter(p => ['client_review', 'requirement_review'].includes(p.status)).length, icon: '👀' },
    { label: 'Completed', value: projects.filter(p => p.status === 'completed').length, icon: '✅' },
  ].map(s => `
    <div class="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
      <div class="flex items-center justify-between">
        <p class="text-sm text-slate-500 dark:text-slate-400">${s.label}</p><span class="text-lg">${s.icon}</span>
      </div>
      <p class="mt-2 text-3xl font-semibold text-slate-800 dark:text-slate-100">${s.value}</p>
    </div>
  `).join('');

  projectsTableBody.innerHTML = projects.length ? projects.map(p => `
    <tr class="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
      <td class="py-3 px-4"><a href="project.html?id=${p.id}" class="font-medium text-slate-700 dark:text-slate-200 hover:text-teal-700">${p.title}</a></td>
      <td class="py-3 px-4">${statusBadge(p.status)}</td>
      <td class="py-3 px-4 text-sm text-slate-500">${p.progress}%</td>
      <td class="py-3 px-4 text-sm text-slate-500">${p.deadline ? new Date(p.deadline).toLocaleDateString() : '—'}</td>
    </tr>
  `).join('') : `<tr><td colspan="4" class="py-10 text-center text-slate-400">No projects assigned yet.</td></tr>`;

  return profile;
}
