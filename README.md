# TechDream Africa — Client Project Management Portal

A responsive project management web app built with **HTML, Tailwind CSS
(CDN), vanilla JavaScript (ES modules), Chart.js, SortableJS, and
Supabase** (Auth, Postgres, Storage, Realtime, RLS).

## What's included

| Area | Status |
|---|---|
| Marketing landing page (hero, about, services, portfolio, testimonials, FAQ, contact) | ✅ Complete |
| Auth: register, login, forgot/reset password, remember me, session persistence, logout | ✅ Complete |
| 5-step project request wizard + drag-and-drop upload to Supabase Storage | ✅ Complete |
| Client dashboard: stats, recent projects, activity feed | ✅ Complete |
| Project detail page: progress tracker, Kanban (drag & drop), milestones, files, comments, realtime chat with typing indicator | ✅ Complete |
| Developer / Project Manager / Admin dashboards (shared shell, role-filtered data + admin charts) | ✅ Functional shell — extend per role as your workflows firm up |
| Notifications bell with realtime unread badge | ✅ Complete |
| Full SQL schema + Row Level Security policies + Storage bucket policies | ✅ Complete |
| Dark/light mode, toasts, modals, skeleton loading, empty states | ✅ Complete |
| Edge Functions (e.g. transactional email on submission) | ⚪ Not included — see "Next steps" |
| FullCalendar (PM calendar view) | ⚪ Wire up when the calendar UX is defined — hook point left in `dashboard.html` nav |

This is a real, working scaffold — not a mockup. Every button calls an
actual Supabase query. Point it at a real Supabase project and it runs.

## 1. Create your Supabase project

1. Go to [supabase.com](https://supabase.com) → New Project.
2. Once provisioned, open **SQL Editor** and run the entire contents of
   [`sql/schema.sql`](sql/schema.sql). This creates all tables, enums,
   triggers, RLS policies, and the two storage buckets
   (`project-files`, `avatars`).
3. Open **Project Settings → API** and copy your **Project URL** and
   **anon public key**.

## 2. Connect the frontend

Open `js/supabase.js` and replace:

```js
export const SUPABASE_URL = 'https://YOUR-PROJECT-REF.supabase.co';
export const SUPABASE_ANON_KEY = 'YOUR-ANON-PUBLIC-KEY';
```

with your real values. That's the only required configuration — every
other module imports the shared client from this file.

## 3. Enable email auth

In **Authentication → Providers**, Email is enabled by default.
Under **Authentication → URL Configuration**, set:
- Site URL: your deployed domain (or `http://localhost:PORT` while testing)
- Redirect URLs: add `/login.html`, `/reset-password.html`

Supabase sends verification and password-reset emails automatically;
customize templates under **Authentication → Email Templates**.

## 4. Run locally

No build step — it's static files + ES modules, which require serving
over HTTP (not `file://`) because of CORS on module imports:

```bash
cd tda-portal
python3 -m http.server 8080
# or: npx serve .
```

Visit `http://localhost:8080`.

## 5. Roles

Every new signup lands in `public.users` with `role = 'client'` via the
`handle_new_user()` trigger (see `sql/schema.sql`). To promote someone to
`developer`, `project_manager`, or `admin`, update their row directly in
the Supabase Table Editor, or build an admin "Manage Users" panel that
calls:

```js
await supabase.from('users').update({ role: 'developer' }).eq('id', userId);
```

(Only an existing `admin` can do this — enforced by the
`users_admin_update_any` RLS policy.)

## 6. Project structure

```
/index.html            Landing page
/login.html             Login + forgot password
/register.html          Registration
/reset-password.html    Password reset landing (from email link)
/dashboard.html          Role-aware dashboard (client / developer / PM / admin)
/new-project.html       5-step project request wizard
/project.html           Project detail: kanban, milestones, files, chat, comments
/profile.html            Profile + password management

/assets/css/style.css   Fonts, glassmorphism, animations, focus states
/js/
  supabase.js            Client singleton + auth guards
  auth.js                 Register / login / logout / password reset
  projects.js             Project CRUD, wizard submission, pipeline helpers
  uploads.js               Dropzone + Supabase Storage transfers
  chat.js                   Realtime messaging + typing indicator
  notifications.js         Bell dropdown + realtime unread badge
  dashboard.js             Role-based dashboard rendering
  ui.js                      Toasts, modals, theme, sidebar, skeletons

/components/            Reference markup for navbar/sidebar/footer
                          (copy-pasted into pages — see file headers for why)
/sql/schema.sql          Tables, enums, triggers, RLS, storage policies
```

## 7. Deploying

Any static host works (Netlify, Vercel, Cloudflare Pages, GitHub Pages,
or Supabase's own static hosting via a bucket). No server runtime is
required — Supabase *is* the backend. Just:

1. Push these files to your host of choice.
2. Confirm the Site URL / Redirect URLs in Supabase match your live domain.
3. Done.

## 8. Extending toward "production-ready"

The scaffold is functionally complete for the client journey end-to-end
(register → submit project → upload files → track progress → chat →
get notified). Before a real launch, budget time for:

- **Edge Function for email**: the DB trigger creates in-app
  notifications on submission; wire a Supabase Edge Function (or a
  service like Resend/Postmark) to also send the "confirmation email"
  and "notify Project Manager" emails called out in the brief.
- **FullCalendar integration** for the PM's project calendar tab.
- **Admin "Manage Users" and "System Logs" UI** — the DB and RLS
  already support this; only the screens need building.
- **File version history** — `project_files` currently stores one row
  per upload; group by `filename` client-side, or add a `version` int
  column if you want in-place replace instead of append.
- **Automated tests** and a CI pipeline once the UI stabilizes.

## Design tokens

| Token | Hex |
|---|---|
| Primary (Teal) | `#0F766E` |
| Secondary (Slate) | `#1E293B` |
| Accent (Blue) | `#2563EB` |
| Success | `#10B981` |
| Warning | `#F59E0B` |
| Error | `#EF4444` |

Fonts: **Sora** (display/headings), **Inter** (body) — loaded via
Google Fonts in `assets/css/style.css`.
