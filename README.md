# LightPM

A lightweight, modular project management app. Username/password login only — no email collection, no third-party auth.

**Stack:** Next.js 14 (App Router) · TypeScript · Tailwind CSS · Supabase (Postgres) · Vercel

---

## Features

| Area | What you get |
|---|---|
| **Auth** | Register (username, password, confirm password), login, logout. Passwords hashed with bcrypt, session in an httpOnly JWT cookie. |
| **Profile** | Name, Title, Role — editable, shown across projects. |
| **Projects** | List all projects with progress and overdue counts; filter by status; create, edit, delete. |
| **Project detail** | Four tabs: Tasks, Kanban, Timeline, Members. |
| **Tasks & sub-tasks** | Nested one level. Status, priority, assignee, start date, due date, SLA date. |
| **Kanban** | Drag-and-drop between To Do / In Progress / Blocked / Done, with optimistic updates. |
| **Timeline (Gantt)** | Pure-CSS bar chart with auto-scaling day width and a "today" marker. No chart library. |
| **Members** | Search and add registered users, or type in a "data member" (Name/Title/Role) who never logs in but can still be assigned tasks. |
| **Standalone tasks** | Tasks with no project, on their own page, with the same List/Kanban/Timeline views. |
| **Reports** | Totals, completion, overdue, due-soon, SLA compliance %, plus per-project and per-assignee breakdowns. |

---

## Architecture

```
app/
  (auth)/          login, register        — public pages
  (app)/           dashboard, projects, tasks, reports, profile — behind auth
  api/             all server routes
components/        Sidebar, TaskList, KanbanBoard, GanttTimeline, ProjectMembers, TaskModal, Modal, Badges
lib/               auth.ts, supabaseServer.ts, requireUser.ts, api.ts, tasks.ts
types/             shared TypeScript types
supabase/          schema.sql
middleware.ts      route protection
```

**The browser never talks to Supabase directly.** Every query goes through a Next.js API route using the service role key, server-side. Row Level Security is enabled and set to deny-all as defense in depth, in case the anon key is ever exposed by mistake.

### Adding a new module later

The app is deliberately modular. To add a feature (say, comments):

1. Add a table to `supabase/schema.sql` and run it.
2. Add a type to `types/index.ts`.
3. Add `app/api/comments/route.ts`, starting with `const auth = await requireUser();`.
4. Add a component in `components/`, and a tab or page that uses it.

Nothing else needs to change. Sidebar links live in one array in `components/Sidebar.tsx`.

---

## 1. Set up Supabase

1. Go to [supabase.com](https://supabase.com), create a project, and wait for it to finish provisioning.
2. In the dashboard, open **SQL Editor → New query**.
3. Paste the entire contents of `supabase/schema.sql` and click **Run**.
4. Open **Project Settings → Data API** and copy the **Project URL**.
5. Open **Project Settings → API Keys** and copy the **`service_role`** key (the secret one, *not* `anon`).

> The `service_role` key bypasses Row Level Security. Keep it server-side only. Never put it in a `NEXT_PUBLIC_*` variable.

---

## 2. Run locally

```bash
npm install
cp .env.example .env.local
```

Edit `.env.local`:

```
SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SESSION_SECRET=a-long-random-string
```

Generate a session secret with:

```bash
openssl rand -base64 32
```

Then:

```bash
npm run dev
```

Open http://localhost:3000 and register your first account.

---

## 3. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit: LightPM"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO.git
git push -u origin main
```

`.env.local` is gitignored, so your keys stay out of the repo.

---

## 4. Deploy to Vercel

1. Go to [vercel.com/new](https://vercel.com/new) and import your GitHub repo.
2. Framework preset should auto-detect as **Next.js**. Leave build settings alone.
3. Before deploying, open **Environment Variables** and add all three:

   | Name | Value |
   |---|---|
   | `SUPABASE_URL` | your Project URL |
   | `SUPABASE_SERVICE_ROLE_KEY` | your service_role key |
   | `SESSION_SECRET` | your long random string |

   Add each to **Production**, **Preview**, and **Development**.
4. Click **Deploy**.

Every push to `main` redeploys automatically. If you change environment variables later, redeploy for them to take effect.

---

## Notes

- **Sub-tasks** are one level deep by design — the schema supports deeper nesting via `parent_task_id`, but the UI renders two levels to keep it readable.
- **SLA** uses `sla_date`, falling back to `due_date`. A task is overdue when that date has passed and its status isn't `done`. This logic lives in `lib/api.ts` (client) and `app/api/reports/route.ts` (server).
- **Data members** get a password hash of `!placeholder-no-login`, which no bcrypt hash can ever match, so those accounts can't be logged into.
- There's no password reset flow, since there's no email on file. An admin would need to update the `password_hash` directly, or the user re-registers.
