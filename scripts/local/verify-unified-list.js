/**
 * Proves the Tasks screen is one table over every task.
 *
 * Phase 3 of docs/redesign/05-light-plan.md: the page used to default to
 * `?standalone=true`, so project-bound tasks were only reachable through a
 * project. It now always asks for the whole list and filters in the client, so
 * this checks that the unfiltered endpoint really does return both kinds - which
 * is the contract the unified table depends on.
 *
 * usage: node scripts/local/verify-unified-list.js [baseUrl]
 */

const BASE = process.argv[2] || "http://localhost:3000";

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
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: res.status, json, setCookie: res.headers.getSetCookie?.() || [] };
}

(async () => {
  console.log(`=== unified task table check against ${BASE} ===`);

  const login = await call("POST", "/api/auth/login", {
    username: "admin",
    password: "password123",
  });
  if (login.status !== 200) {
    console.error(`  FAIL  login returned ${login.status}`);
    process.exit(1);
  }
  const cookie = login.setCookie.map((c) => c.split(";")[0]).join("; ");

  const projects = await call("GET", "/api/projects", undefined, cookie);
  const project = (projects.json?.projects || []).find((p) => p.name === "Apollo Design System");
  check("found the seeded project", !!project, `id=${project?.id}`);

  const stamp = Date.now().toString().slice(-6);

  // 1. a task with no project at all
  const loose = await call(
    "POST",
    "/api/tasks",
    { title: `Unified list, no project ${stamp}`, priority: "medium" },
    cookie
  );
  const looseId = loose.json?.task?.id;
  check("created a task with no project", loose.status === 200 && !!looseId, `status=${loose.status}`);

  // 2. a task inside a project
  const bound = await call(
    "POST",
    "/api/tasks",
    {
      title: `Unified list, in project ${stamp}`,
      project_id: project?.id,
      priority: "medium",
    },
    cookie
  );
  const boundId = bound.json?.task?.id;
  check("created a task inside a project", bound.status === 200 && !!boundId, `status=${bound.status}`);

  // 3. the whole list - one request, both kinds
  const all = await call("GET", "/api/tasks", undefined, cookie);
  const tasks = all.json?.tasks || [];
  const looseFound = tasks.find((t) => t.id === looseId);
  const boundFound = tasks.find((t) => t.id === boundId);

  check("unfiltered /api/tasks returns project-less tasks", !!looseFound, `count=${tasks.length}`);
  check("unfiltered /api/tasks returns project-bound tasks", !!boundFound);
  check("the project-less task has no project", looseFound?.project_id === null);
  check(
    "the project-bound task carries its project",
    boundFound?.project?.name === "Apollo Design System",
    `project=${boundFound?.project?.name}`
  );

  // The old default view only saw half the data; this quantifies the difference.
  const only_loose = await call("GET", "/api/tasks?standalone=true", undefined, cookie);
  const looseCount = (only_loose.json?.tasks || []).length;
  check(
    "the old scope would have hidden project work",
    looseCount < tasks.length,
    `standalone=${looseCount} of ${tasks.length}`
  );

  console.log("");
  if (failures > 0) {
    console.error(`${failures} check(s) FAILED`);
    process.exit(1);
  }
  console.log("one table over every task confirmed");
  process.exit(0);
})().catch((e) => {
  console.error(`  FAIL  unexpected error: ${e.message}`);
  process.exit(1);
});
