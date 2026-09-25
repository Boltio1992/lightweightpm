import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";

type AdminClient = SupabaseClient<any, any, any>;

let cached: AdminClient | null = null;

// In-memory data store for running in AI Studio without requiring external Supabase credentials
interface Store {
  users: any[];
  projects: any[];
  project_members: any[];
  project_statuses: any[];
  tasks: any[];
  task_comments: any[];
  task_activity: any[];
}

function getInitialStore(): Store {
  const adminId = "a0000000-0000-4000-8000-000000000001";
  const janeId = "a0000000-0000-4000-8000-000000000002";
  const marcusId = "a0000000-0000-4000-8000-000000000003";

  const p1Id = "b0000000-0000-4000-8000-000000000001";
  const p2Id = "b0000000-0000-4000-8000-000000000002";

  const t1Id = "c0000000-0000-4000-8000-000000000001";
  const t2Id = "c0000000-0000-4000-8000-000000000002";
  const t3Id = "c0000000-0000-4000-8000-000000000003";
  const t4Id = "c0000000-0000-4000-8000-000000000004";
  const t5Id = "c0000000-0000-4000-8000-000000000005";
  const t6Id = "c0000000-0000-4000-8000-000000000006";
  const t2Sub1Id = "c0000000-0000-4000-8000-000000000007";
  const t2Sub2Id = "c0000000-0000-4000-8000-000000000008";

  const passwordHash = bcrypt.hashSync("password123", 10);
  const now = new Date().toISOString();

  return {
    users: [
      {
        id: adminId,
        username: "admin",
        password_hash: passwordHash,
        name: "Alex Rivera",
        title: "Lead Architect",
        role: "admin",
        is_placeholder: false,
        created_at: now,
      },
      {
        id: janeId,
        username: "jane",
        password_hash: passwordHash,
        name: "Jane Doe",
        title: "Product Designer",
        role: "member",
        is_placeholder: false,
        created_at: now,
      },
      {
        id: marcusId,
        username: "marcus",
        password_hash: passwordHash,
        name: "Marcus Chen",
        title: "Frontend Engineer",
        role: "member",
        is_placeholder: false,
        created_at: now,
      },
    ],
    projects: [
      {
        id: p1Id,
        name: "Apollo Design System",
        description: "Design tokens, accessible primitives, and interactive documentation",
        status: "active",
        start_date: "2026-09-01",
        end_date: "2026-10-31",
        percent_complete: 60,
        accent_color: "#12A594",
        icon: "sparkles",
        owner_id: adminId,
        default_view: "kanban",
        archived_at: null,
        created_by: adminId,
        created_at: now,
        updated_at: now,
      },
      {
        id: p2Id,
        name: "Mobile App v2",
        description: "Next-gen offline capabilities, responsive layouts and notifications",
        status: "active",
        start_date: "2026-09-15",
        end_date: "2026-11-20",
        percent_complete: 35,
        accent_color: "#6366F1",
        icon: "rocket",
        owner_id: adminId,
        default_view: "kanban",
        archived_at: null,
        created_by: adminId,
        created_at: now,
        updated_at: now,
      },
    ],
    project_statuses: [
      { id: randomUUID(), project_id: p1Id, name: "To Do", key: "todo", color: "#94A3B8", sort_order: 0, is_done: false },
      { id: randomUUID(), project_id: p1Id, name: "In Progress", key: "in_progress", color: "#12A594", sort_order: 1, is_done: false },
      { id: randomUUID(), project_id: p1Id, name: "Review", key: "review", color: "#F59E0B", sort_order: 2, is_done: false },
      { id: randomUUID(), project_id: p1Id, name: "Blocked", key: "blocked", color: "#EF4444", sort_order: 3, is_done: false },
      { id: randomUUID(), project_id: p1Id, name: "Done", key: "done", color: "#10B981", sort_order: 4, is_done: true },

      { id: randomUUID(), project_id: p2Id, name: "To Do", key: "todo", color: "#94A3B8", sort_order: 0, is_done: false },
      { id: randomUUID(), project_id: p2Id, name: "In Progress", key: "in_progress", color: "#6366F1", sort_order: 1, is_done: false },
      { id: randomUUID(), project_id: p2Id, name: "Review", key: "review", color: "#F59E0B", sort_order: 2, is_done: false },
      { id: randomUUID(), project_id: p2Id, name: "Blocked", key: "blocked", color: "#EF4444", sort_order: 3, is_done: false },
      { id: randomUUID(), project_id: p2Id, name: "Done", key: "done", color: "#10B981", sort_order: 4, is_done: true },
    ],
    project_members: [
      {
        id: randomUUID(),
        project_id: p1Id,
        user_id: adminId,
        role: "owner",
        added_at: now,
      },
      {
        id: randomUUID(),
        project_id: p1Id,
        user_id: janeId,
        role: "admin",
        added_at: now,
      },
      {
        id: randomUUID(),
        project_id: p1Id,
        user_id: marcusId,
        role: "member",
        added_at: now,
      },
      {
        id: randomUUID(),
        project_id: p2Id,
        user_id: adminId,
        role: "owner",
        added_at: now,
      },
      {
        id: randomUUID(),
        project_id: p2Id,
        user_id: marcusId,
        role: "member",
        added_at: now,
      },
    ],
    tasks: [
      {
        id: t1Id,
        project_id: p1Id,
        parent_task_id: null,
        title: "Audit component accessibility contrast",
        description: "Verify WCAG 2.1 AA compliance across light and dark tokens.",
        status: "done",
        priority: "high",
        assignee_id: janeId,
        start_date: "2026-09-02",
        due_date: "2026-09-10",
        duration_days: 8,
        percent_complete: 100,
        sort_order: 0,
        tags: ["accessibility", "design-system"],
        created_by: adminId,
        created_at: now,
        updated_at: now,
      },
      {
        id: t2Id,
        project_id: p1Id,
        parent_task_id: null,
        title: "Build Modal & Drawer primitives",
        description: "Accessible dialog elements with focus trapping and smooth transitions.",
        status: "in_progress",
        priority: "urgent",
        assignee_id: marcusId,
        start_date: "2026-09-12",
        due_date: "2026-09-28",
        duration_days: 16,
        percent_complete: 70,
        sort_order: 1,
        tags: ["frontend", "react", "components"],
        created_by: adminId,
        created_at: now,
        updated_at: now,
      },
      {
        id: t2Sub1Id,
        project_id: p1Id,
        parent_task_id: t2Id,
        title: "Trap keyboard focus inside active modal",
        description: "Prevent tabbing outside the dialog frame.",
        status: "done",
        priority: "high",
        assignee_id: marcusId,
        start_date: "2026-09-13",
        due_date: "2026-09-17",
        duration_days: 4,
        percent_complete: 100,
        sort_order: 0,
        tags: ["accessibility"],
        created_by: adminId,
        created_at: now,
        updated_at: now,
      },
      {
        id: t2Sub2Id,
        project_id: p1Id,
        parent_task_id: t2Id,
        title: "Handle Escape key press & body scroll lock",
        description: "Close modal on Escape and prevent body scrolling when modal is open.",
        status: "in_progress",
        priority: "medium",
        assignee_id: marcusId,
        start_date: "2026-09-18",
        due_date: "2026-09-22",
        duration_days: 4,
        percent_complete: 60,
        sort_order: 1,
        tags: ["ui"],
        created_by: adminId,
        created_at: now,
        updated_at: now,
      },
      {
        id: t3Id,
        project_id: p1Id,
        parent_task_id: null,
        title: "Document typography scale & tokens",
        description: "Spec guidelines for responsive headline scales and tracking.",
        status: "review",
        priority: "medium",
        assignee_id: adminId,
        start_date: "2026-09-15",
        due_date: "2026-09-25",
        duration_days: 10,
        percent_complete: 90,
        sort_order: 2,
        tags: ["documentation", "typography"],
        created_by: adminId,
        created_at: now,
        updated_at: now,
      },
      {
        id: t4Id,
        project_id: p1Id,
        parent_task_id: null,
        title: "Color palette high-contrast mode testing",
        description: "Test high contrast mode on Windows and OLED displays.",
        status: "todo",
        priority: "low",
        assignee_id: janeId,
        start_date: "2026-09-20",
        due_date: "2026-10-05",
        duration_days: 15,
        percent_complete: 0,
        sort_order: 3,
        tags: ["qa", "contrast"],
        created_by: adminId,
        created_at: now,
        updated_at: now,
      },
      {
        id: t5Id,
        project_id: p1Id,
        parent_task_id: null,
        title: "Safari rendering glitch on SVG icons",
        description: "Investigate subpixel antialiasing issues on Safari macOS.",
        status: "blocked",
        priority: "high",
        assignee_id: marcusId,
        start_date: "2026-09-18",
        due_date: "2026-09-26",
        duration_days: 8,
        percent_complete: 20,
        sort_order: 4,
        tags: ["bug", "safari"],
        created_by: adminId,
        created_at: now,
        updated_at: now,
      },
      {
        id: t6Id,
        project_id: null,
        parent_task_id: null,
        title: "Quarterly architectural roadmap review",
        description: "Evaluate framework upgrades and performance metrics.",
        status: "todo",
        priority: "high",
        assignee_id: adminId,
        start_date: "2026-09-22",
        due_date: "2026-09-30",
        duration_days: 8,
        percent_complete: 0,
        sort_order: 0,
        tags: ["architecture", "planning"],
        created_by: adminId,
        created_at: now,
        updated_at: now,
      },
    ],
    task_comments: [
      {
        id: randomUUID(),
        task_id: t1Id,
        user_id: janeId,
        content: "Completed full automated check on Chrome and Firefox. All token contrast ratios meet 4.5:1 AA standard.",
        created_at: now,
      },
      {
        id: randomUUID(),
        task_id: t2Id,
        user_id: marcusId,
        content: "Added initial prototype. Working on the focus trapping subtask now.",
        created_at: now,
      },
    ],
    task_activity: [
      {
        id: randomUUID(),
        task_id: t1Id,
        user_id: adminId,
        action: "created",
        details: "created the task",
        created_at: now,
      },
      {
        id: randomUUID(),
        task_id: t1Id,
        user_id: janeId,
        action: "status_changed",
        details: "marked task as Done",
        created_at: now,
      },
      {
        id: randomUUID(),
        task_id: t2Id,
        user_id: adminId,
        action: "created",
        details: "created the task",
        created_at: now,
      },
      {
        id: randomUUID(),
        task_id: t2Id,
        user_id: marcusId,
        action: "status_changed",
        details: "moved status to In Progress",
        created_at: now,
      },
    ],
  };
}

const globalStore = (globalThis as any).__lightpm_store || ((globalThis as any).__lightpm_store = getInitialStore());

function createMockClient(): AdminClient {
  return {
    from(tableName: string) {
      const store = globalStore;
      const filters: Array<(row: any) => boolean> = [];
      let sortCol: string | null = null;
      let sortAsc = true;
      let limitCount: number | null = null;
      let selectedCols: string | null = null;
      let opType: "select" | "insert" | "update" | "delete" = "select";
      let opPayload: any = null;

      const builder: any = {
        select(cols?: string) {
          if (cols) selectedCols = cols;
          return builder;
        },
        insert(payload: any) {
          opType = "insert";
          opPayload = payload;
          return builder;
        },
        update(payload: any) {
          opType = "update";
          opPayload = payload;
          return builder;
        },
        delete() {
          opType = "delete";
          return builder;
        },
        eq(column: string, value: any) {
          filters.push((row) => row[column] === value);
          return builder;
        },
        is(column: string, value: any) {
          filters.push((row) => row[column] === value);
          return builder;
        },
        not(column: string, op: string, value: any) {
          if (op === "is") {
            filters.push((row) => row[column] !== value);
          }
          return builder;
        },
        in(column: string, values: any[]) {
          filters.push((row) => values.includes(row[column]));
          return builder;
        },
        or(conditionStr: string) {
          // e.g. "name.ilike.%q%,username.ilike.%q%"
          const parts = conditionStr.split(",");
          filters.push((row) => {
            return parts.some((p) => {
              const match = p.match(/^([a-zA-Z0-9_]+)\.ilike\.%(.*)%$/);
              if (match) {
                const [, col, term] = match;
                const val = String(row[col] ?? "").toLowerCase();
                return val.includes(term.toLowerCase());
              }
              return false;
            });
          });
          return builder;
        },
        order(column: string, opts?: { ascending?: boolean }) {
          sortCol = column;
          sortAsc = opts?.ascending !== false;
          return builder;
        },
        limit(count: number) {
          limitCount = count;
          return builder;
        },

        async _execute() {
          if (!store[tableName as keyof Store]) {
            (store as any)[tableName] = [];
          }
          const list: any[] = store[tableName as keyof Store] || [];

          if (opType === "insert") {
            const items = Array.isArray(opPayload) ? opPayload : [opPayload];
            const now = new Date().toISOString();
            const inserted = items.map((item) => {
              const row = {
                id: item.id || randomUUID(),
                created_at: item.created_at || now,
                updated_at: item.updated_at || now,
                ...item,
              };
              list.push(row);
              return row;
            });

            // If a new project is created, auto-seed default statuses if not present
            if (tableName === "projects") {
              if (!store.project_statuses) store.project_statuses = [];
              for (const proj of inserted) {
                if (!store.project_statuses.some((s: any) => s.project_id === proj.id)) {
                  const defaults = [
                    { name: "To Do", key: "todo", color: "#94A3B8", sort_order: 0, is_done: false },
                    { name: "In Progress", key: "in_progress", color: proj.accent_color || "#12A594", sort_order: 1, is_done: false },
                    { name: "Review", key: "review", color: "#F59E0B", sort_order: 2, is_done: false },
                    { name: "Blocked", key: "blocked", color: "#EF4444", sort_order: 3, is_done: false },
                    { name: "Done", key: "done", color: "#10B981", sort_order: 4, is_done: true },
                  ];
                  for (const d of defaults) {
                    store.project_statuses.push({
                      id: randomUUID(),
                      project_id: proj.id,
                      ...d,
                    });
                  }
                }
              }
            }

            return { data: builder._format(inserted), error: null };
          }

          if (opType === "update") {
            const now = new Date().toISOString();
            const updated: any[] = [];
            for (let i = 0; i < list.length; i++) {
              if (filters.every((f) => f(list[i]))) {
                list[i] = {
                  ...list[i],
                  ...opPayload,
                  updated_at: now,
                };
                updated.push(list[i]);
              }
            }
            return { data: builder._format(updated), error: null };
          }

          if (opType === "delete") {
            const toDeleteIds: string[] = [];
            for (let i = list.length - 1; i >= 0; i--) {
              if (filters.every((f) => f(list[i]))) {
                toDeleteIds.push(list[i].id);
                list.splice(i, 1);
              }
            }

            // Cascade deletes if deleting projects or tasks
            if (tableName === "projects") {
              for (const pid of toDeleteIds) {
                store.tasks = (store.tasks || []).filter((t: any) => t.project_id !== pid);
                store.project_members = (store.project_members || []).filter((m: any) => m.project_id !== pid);
                store.project_statuses = (store.project_statuses || []).filter((s: any) => s.project_id !== pid);
              }
            } else if (tableName === "tasks") {
              for (const tid of toDeleteIds) {
                store.tasks = (store.tasks || []).filter((t: any) => t.parent_task_id !== tid);
                store.task_comments = (store.task_comments || []).filter((c: any) => c.task_id !== tid);
                store.task_activity = (store.task_activity || []).filter((a: any) => a.task_id !== tid);
              }
            }

            return { data: null, error: null };
          }

          // Read / Select
          let matches = list.filter((row) => filters.every((f) => f(row)));

          if (sortCol) {
            matches.sort((a, b) => {
              const va = a[sortCol!];
              const vb = b[sortCol!];
              if (va == null && vb == null) return 0;
              if (va == null) return sortAsc ? 1 : -1;
              if (vb == null) return sortAsc ? -1 : 1;
              if (va < vb) return sortAsc ? -1 : 1;
              if (va > vb) return sortAsc ? 1 : -1;
              return 0;
            });
          }

          if (limitCount != null) {
            matches = matches.slice(0, limitCount);
          }

          return { data: builder._format(matches), error: null };
        },

        _format(rows: any[]) {
          return rows.map((row) => {
            const formatted = { ...row };
            if (tableName === "tasks") {
              const project = (store.projects || []).find((p: any) => p.id === row.project_id);
              const assignee = (store.users || []).find((u: any) => u.id === row.assignee_id);
              formatted.project = project ? { id: project.id, name: project.name } : null;
              formatted.assignee = assignee
                ? {
                    id: assignee.id,
                    username: assignee.username,
                    name: assignee.name,
                    title: assignee.title,
                    role: assignee.role,
                    created_at: assignee.created_at,
                  }
                : null;
              formatted.tags = row.tags ?? [];
            } else if (tableName === "project_members") {
              const user = (store.users || []).find((u: any) => u.id === row.user_id);
              formatted.user = user
                ? {
                    id: user.id,
                    username: user.username,
                    name: user.name,
                    title: user.title,
                    role: user.role,
                    created_at: user.created_at,
                  }
                : null;
              const memberTasks = (store.tasks || []).filter(
                (t: any) => t.project_id === row.project_id && t.assignee_id === row.user_id
              );
              formatted.workload = {
                total: memberTasks.length,
                in_progress: memberTasks.filter((t: any) => t.status === "in_progress").length,
                done: memberTasks.filter((t: any) => t.status === "done").length,
              };
            } else if (tableName === "projects") {
              const owner = (store.users || []).find((u: any) => u.id === row.owner_id);
              formatted.owner = owner
                ? {
                    id: owner.id,
                    username: owner.username,
                    name: owner.name,
                    title: owner.title,
                    role: owner.role,
                    created_at: owner.created_at,
                  }
                : null;
            } else if (tableName === "task_comments") {
              const user = (store.users || []).find((u: any) => u.id === row.user_id);
              formatted.user = user
                ? {
                    id: user.id,
                    username: user.username,
                    name: user.name,
                    title: user.title,
                    role: user.role,
                    created_at: user.created_at,
                  }
                : null;
            } else if (tableName === "task_activity") {
              const user = (store.users || []).find((u: any) => u.id === row.user_id);
              formatted.user = user
                ? {
                    id: user.id,
                    username: user.username,
                    name: user.name,
                    title: user.title,
                    role: user.role,
                    created_at: user.created_at,
                  }
                : null;
            }
            return formatted;
          });
        },

        async single() {
          const res = await builder._execute();
          if (res.error) return res;
          const rows = res.data ?? [];
          if (rows.length === 0) {
            return { data: null, error: { message: "Row not found", code: "PGRST116" } };
          }
          return { data: rows[0], error: null };
        },

        async maybeSingle() {
          const res = await builder._execute();
          if (res.error) return res;
          const rows = res.data ?? [];
          return { data: rows[0] ?? null, error: null };
        },

        then(resolve: any, reject: any) {
          return builder._execute().then(resolve, reject);
        },
      };

      return builder;
    },
  } as unknown as AdminClient;
}

function isRealSupabaseConfigured(): boolean {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return false;
  if (
    url.includes("YOUR-PROJECT-REF") ||
    url.includes("placeholder") ||
    url.includes("example.com") ||
    key === "your-service-role-key" ||
    key.length < 20
  ) {
    return false;
  }
  return true;
}

export function supabaseAdmin(): AdminClient {
  if (cached) return cached;

  if (isRealSupabaseConfigured()) {
    const url = process.env.SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    try {
      cached = createClient<any, any, any>(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      return cached;
    } catch (e) {
      console.warn("[LightPM] Failed to initialize Supabase client, falling back to in-memory store", e);
    }
  }

  // Use in-memory mock when Supabase credentials are not provided or are placeholders
  cached = createMockClient();
  return cached;
}

export function clearMockStore(options: { preserveUsers?: boolean; reseed?: boolean } = {}) {
  const store = (globalThis as any).__lightpm_store;
  if (!store) return;
  if (options.reseed) {
    const fresh = getInitialStore();
    store.users = fresh.users;
    store.projects = fresh.projects;
    store.project_members = fresh.project_members;
    store.project_statuses = fresh.project_statuses;
    store.tasks = fresh.tasks;
    store.task_comments = fresh.task_comments;
    store.task_activity = fresh.task_activity;
  } else {
    store.tasks = [];
    store.task_comments = [];
    store.task_activity = [];
    store.projects = [];
    store.project_members = [];
    store.project_statuses = [];
    if (!options.preserveUsers) {
      store.users = [];
    }
  }
}

