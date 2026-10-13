/**
 * Proves a project can run on its own status vocabulary.
 *
 * Phase 2 of docs/redesign/05-light-plan.md: task statuses must come from the
 * project's configured set, not from a hard-coded list. This adds a custom
 * status ("UAT") that is NOT in the default vocabulary, creates a task using it,
 * and reads it back - which would have been impossible while the lists were
 * hard-coded in five places.
 *
 * usage: node scripts/local/verify-status-sets.js [baseUrl]
 */

const BASE = process.argv[2] || "http://localhost:3000";
const DEADLINE_MS = 30000;

let failures = 0;

function check(label, ok, detail = "") {
  if (ok) {
    console.log(`  PASS  ${label.padEnd(54)} ${detail}`);
  } else {
    failures += 1;
    console.error(`  FAIL  ${label.padEnd(54)} ${detail}`);
  }
}

async function call(method, path, body, cookie) {
  const headers = {};
  if (cookie) headers.cookie = cookie;
  if (body !== undefined) headers["content-type"] = "application/json";
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null;
  const text = await res.text();
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  const setCookie = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  return { status: res.status, json, text, setCookie };
}

(async () => {
  console.log(`=== project status vocabulary check against ${BASE} ===`);

  const login = await call("POST", "/api/auth/login", {
    username: "admin",
    password: "password123",
  });
  if (login.status !== 200) {
    console.error(`  FAIL  login returned ${login.status}`);
    process.exit(1);
  }
  const cookieHeader = (login.setCookie || []).map((c) => c.split(";")[0]).join("; ");
  check("logged in", login.status === 200, `user=${login.json?.user?.name}`);
  const userId = login.json?.user?.id;

  const stamp = Date.now().toString().slice(-6);
  const project = await call(
    "POST",
    "/api/projects",
    { name: `Status Set Test ${stamp}`, status: "active" },
    cookieHeader
  );
  const projectId = project.json?.project?.id;
  check("created a project", project.status === 200 && !!projectId, `id=${projectId}`);

  const seeded = await call("GET", `/api/projects/${projectId}/statuses`, undefined, cookieHeader);
  const seededKeys = (seeded.json?.statuses || []).map((s) => s.key);
  check(
    "new project seeds the default vocabulary",
    seeded.status === 200 && seededKeys.length === 5,
    `keys=${seededKeys.join(",")}`
  );

  // "uat" is deliberately NOT in the default set.
  const added = await call(
    "POST",
    `/api/projects/${projectId}/statuses`,
    { name: "UAT", key: "uat", color: "#F59E0B", is_done: false },
    cookieHeader
  );
  // 201 Created is the correct response here; accept any 2xx.
  check("added a custom status", added.status >= 200 && added.status < 300, `status=${added.status}`);

  const after = await call("GET", `/api/projects/${projectId}/statuses`, undefined, cookieHeader);
  const keys = (after.json?.statuses || []).map((s) => s.key);
  check("custom status is persisted", keys.includes("uat"), `keys=${keys.join(",")}`);

  // The creator is not a member automatically, and task creation checks
  // membership when a project is given.
  const member = await call(
    "POST",
    `/api/projects/${projectId}/members`,
    { user_id: userId, role: "owner" },
    cookieHeader
  );
  check("added the creator as a member", member.status === 200, `status=${member.status}`);

  const task = await call(
    "POST",
    "/api/tasks",
    { title: "Task on a custom status", project_id: projectId, status: "uat", priority: "medium" },
    cookieHeader
  );
  const taskId = task.json?.task?.id;
  check("created a task on the custom status", task.status === 200 && !!taskId, `status=${task.status}`);

  const list = await call("GET", "/api/tasks", undefined, cookieHeader);
  const found = (list.json?.tasks || []).find((t) => t.id === taskId);
  check("custom status round-trips", found?.status === "uat", `status=${found?.status}`);
  check("task keeps its project link", !!found?.project, `project=${found?.project?.name}`);

  console.log("");
  if (failures > 0) {
    console.error(`${failures} check(s) FAILED`);
    process.exit(1);
  }
  console.log("project-specific status vocabulary confirmed");
  process.exit(0);
})().catch((e) => {
  console.error(`  FAIL  unexpected error: ${e.message}`);
  process.exit(1);
});
