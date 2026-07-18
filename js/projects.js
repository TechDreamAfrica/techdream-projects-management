// ============================================================================
// Projects — creation (wizard), fetching, status/progress helpers.
// ============================================================================
import { supabase } from './supabase.js';
import { uploadProjectFiles } from './uploads.js';

// Canonical pipeline used by the visual progress tracker.
export const PIPELINE = [
  'submitted', 'requirement_review', 'approved', 'design',
  'development', 'testing', 'client_review', 'revision',
  'deployment', 'completed',
];

export function progressFromStatus(status) {
  const idx = PIPELINE.indexOf(status);
  if (idx === -1) return 0;
  return Math.round((idx / (PIPELINE.length - 1)) * 100);
}

export function statusLabel(status) {
  return (status || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// -------------------------------------------------------- Create project ---
// `wizardData` shape matches the 5-step form in new-project.html.
// `files` is a FileList/array of File objects from step 4.
export async function submitProjectRequest(wizardData, files) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('You must be signed in to submit a project.');

  const payload = {
    client_id: user.id,
    title: wizardData.projectName,
    industry: wizardData.industry,
    description: wizardData.description,
    business_goals: wizardData.businessGoals,
    target_audience: wizardData.targetAudience,
    budget: wizardData.budget ? Number(wizardData.budget) : null,
    deadline: wizardData.deadline || null,
    preferred_technology: wizardData.preferredTechnology,
    features: wizardData.features || [],
    custom_features: wizardData.customFeatures || null,
    communication_preference: wizardData.communicationPreference,
    meeting_availability: wizardData.meetingAvailability,
    nda_required: !!wizardData.ndaRequired,
    additional_notes: wizardData.additionalNotes,
    status: 'submitted',
    progress: progressFromStatus('submitted'),
  };

  const { data: project, error } = await supabase.from('projects').insert(payload).select().single();
  if (error) throw error;

  if (files && files.length) {
    await uploadProjectFiles(project.id, files, 'requirements');
  }

  // Client info (name/company/phone/country) updates the profile in-place —
  // clients often haven't fully completed their profile at signup.
  await supabase.from('users').update({
    fullname: wizardData.fullName || undefined,
    company: wizardData.company || undefined,
    phone: wizardData.phone || undefined,
    country: wizardData.country || undefined,
  }).eq('id', user.id);

  return project;
}

// ------------------------------------------------------------- Fetching ----
export async function getMyProjects() {
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single();

  let query = supabase.from('projects').select('*').order('created_at', { ascending: false });

  if (profile?.role === 'client') query = query.eq('client_id', user.id);
  else if (profile?.role === 'developer') query = query.eq('assigned_developer', user.id);
  // project_manager and admin see all projects (governed by RLS)

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function getProject(projectId) {
  const { data, error } = await supabase.from('projects').select('*').eq('id', projectId).single();
  if (error) throw error;
  return data;
}

export async function updateProjectStatus(projectId, status) {
  const { error } = await supabase.from('projects')
    .update({ status, progress: progressFromStatus(status) })
    .eq('id', projectId);
  if (error) throw error;
}

export async function getMilestones(projectId) {
  const { data, error } = await supabase.from('milestones')
    .select('*').eq('project_id', projectId).order('due_date', { ascending: true });
  if (error) throw error;
  return data;
}

export async function getTasks(projectId) {
  const { data, error } = await supabase.from('tasks')
    .select('*').eq('project_id', projectId).order('position', { ascending: true });
  if (error) throw error;
  return data;
}

export async function updateTaskStatus(taskId, status) {
  const { error } = await supabase.from('tasks').update({ status }).eq('id', taskId);
  if (error) throw error;
}

export async function createTask(task) {
  const { data, error } = await supabase.from('tasks').insert(task).select().single();
  if (error) throw error;
  return data;
}

export async function getComments(projectId) {
  const { data, error } = await supabase.from('comments')
    .select('*, users(fullname, avatar)').eq('project_id', projectId).order('created_at');
  if (error) throw error;
  return data;
}

export async function addComment(projectId, comment) {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from('comments').insert({ project_id: projectId, user_id: user.id, comment });
  if (error) throw error;
}

// --------------------------------------------------------- Dashboard stats -
export async function getClientStats() {
  const projects = await getMyProjects();
  return {
    active: projects.filter(p => !['completed', 'cancelled'].includes(p.status)).length,
    pending: projects.filter(p => p.status === 'submitted' || p.status === 'requirement_review').length,
    completed: projects.filter(p => p.status === 'completed').length,
    total: projects.length,
  };
}
