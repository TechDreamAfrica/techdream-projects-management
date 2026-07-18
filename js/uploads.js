// ============================================================================
// Uploads — drag-and-drop handling + Supabase Storage transfers.
// Files are stored at:  project-files/{project_id}/{folder}/{timestamp}-{name}
// ============================================================================
import { supabase } from './supabase.js';

export const ACCEPTED_TYPES = ['.pdf', '.docx', '.xlsx', '.zip', '.png', '.jpg', '.jpeg', '.mp4', '.pptx'];
export const MAX_FILE_SIZE_MB = 100;

export function isAcceptedFile(file) {
  const ext = '.' + file.name.split('.').pop().toLowerCase();
  return ACCEPTED_TYPES.includes(ext) && file.size <= MAX_FILE_SIZE_MB * 1024 * 1024;
}

export function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

// Wires a drop-zone element + hidden <input type="file"> to a callback that
// receives the accumulated FileList-like array. Renders preview chips into
// `previewListEl` with a remove button per file.
export function initDropzone({ dropzoneEl, inputEl, previewListEl, onChange }) {
  let files = [];

  const render = () => {
    previewListEl.innerHTML = files.map((f, i) => `
      <div class="flex items-center justify-between gap-3 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 bg-white dark:bg-slate-800">
        <div class="flex items-center gap-2 min-w-0">
          <span class="text-lg">${fileIcon(f.name)}</span>
          <div class="min-w-0">
            <p class="text-sm font-medium truncate max-w-[220px] text-slate-700 dark:text-slate-200">${f.name}</p>
            <p class="text-xs text-slate-400">${formatBytes(f.size)}</p>
          </div>
        </div>
        <button type="button" data-remove-idx="${i}" class="text-slate-400 hover:text-red-500 transition-colors text-sm">✕</button>
      </div>
    `).join('');
    onChange?.(files);
  };

  previewListEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-remove-idx]');
    if (!btn) return;
    files.splice(Number(btn.dataset.removeIdx), 1);
    render();
  });

  const addFiles = (incoming) => {
    for (const f of Array.from(incoming)) {
      if (!isAcceptedFile(f)) continue;
      files.push(f);
    }
    render();
  };

  ['dragenter', 'dragover'].forEach(evt =>
    dropzoneEl.addEventListener(evt, (e) => { e.preventDefault(); dropzoneEl.classList.add('border-teal-500', 'bg-teal-50', 'dark:bg-teal-950/30'); }));
  ['dragleave', 'drop'].forEach(evt =>
    dropzoneEl.addEventListener(evt, (e) => { e.preventDefault(); dropzoneEl.classList.remove('border-teal-500', 'bg-teal-50', 'dark:bg-teal-950/30'); }));
  dropzoneEl.addEventListener('drop', (e) => addFiles(e.dataTransfer.files));
  dropzoneEl.addEventListener('click', () => inputEl.click());
  inputEl.addEventListener('change', () => addFiles(inputEl.files));

  return { getFiles: () => files, reset: () => { files = []; render(); } };
}

function fileIcon(name) {
  const ext = name.split('.').pop().toLowerCase();
  const map = { pdf: '📄', docx: '📝', xlsx: '📊', zip: '🗜️', png: '🖼️', jpg: '🖼️', jpeg: '🖼️', mp4: '🎬', pptx: '📽️' };
  return map[ext] || '📁';
}

// Uploads an array of File objects to Supabase Storage and records rows in
// project_files. `onProgress(fileName, pct)` is optional.
export async function uploadProjectFiles(projectId, files, folder = 'documents', onProgress) {
  const { data: { user } } = await supabase.auth.getUser();
  const results = [];

  for (const file of Array.from(files)) {
    const path = `${projectId}/${folder}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from('project-files')
      .upload(path, file, { cacheControl: '3600', upsert: false });

    if (uploadError) {
      console.error('Upload failed for', file.name, uploadError);
      onProgress?.(file.name, -1);
      continue;
    }
    onProgress?.(file.name, 100);

    const { data: row, error: dbError } = await supabase.from('project_files').insert({
      project_id: projectId,
      folder,
      filename: file.name,
      storage_path: path,
      size_bytes: file.size,
      mime_type: file.type,
      uploaded_by: user.id,
    }).select().single();

    if (!dbError) results.push(row);
  }
  return results;
}

export async function getProjectFiles(projectId, folder) {
  let query = supabase.from('project_files').select('*').eq('project_id', projectId).order('uploaded_at', { ascending: false });
  if (folder) query = query.eq('folder', folder);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function getFileDownloadUrl(storagePath) {
  const { data, error } = await supabase.storage.from('project-files').createSignedUrl(storagePath, 3600);
  if (error) throw error;
  return data.signedUrl;
}

export async function deleteProjectFile(fileId, storagePath) {
  await supabase.storage.from('project-files').remove([storagePath]);
  const { error } = await supabase.from('project_files').delete().eq('id', fileId);
  if (error) throw error;
}
