/**
 * Verifies the reference links and task members introduced in phase 4.
 *
 * The link assertions matter because those rows are the stand-in for records in
 * the Ticket / CR / CRL systems: `kind` + `reference` are the query key that a
 * later direct query will use, so they must survive round-trips intact.
 *
 * usage: node scripts/local/verify-links-members.js [baseUrl]
 */

const BASE = process.argv[2] || "http://localhost:3000";

let failures = 0;

function check(label, ok, detail = "") {
  if (ok) {
    console.log(`  PASS  ${label.padEnd(56)} ${detail}`);
  } else {
    failures += 1;
    console.error(`  FAIL  ${label.padEnd(56)} ${detail}`);
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
  console.log(`=== reference links + task members against ${BASE} ===`);

  const login = await call("POST", "/api/auth/login", {
    username: "admin",
    password: "password123",
  });
  if (login.status !== 200) {
    console.error(`  FAIL  login returned ${login.status}`);
    process.exit(1);
  }
  const cookie = login.setCookie.map((c) => c.split(";")[0]).join("; ");

  const users = await call("GET", "/api/users", undefined, cookie);
  const jane = (users.json?.users || []).find((u) => u.username === "jane");
  check("found a second user to attach", !!jane, `user=${jane?.username}`);

  const stamp = Date.now().toString().slice(-6);
  const task = await call(
    "POST",
    "/api/tasks",
    { title: `Links and members ${stamp}`, priority: "medium" },
    cookie
  );
  const taskId = task.json?.task?.id;
  check("created a task with no project", task.status === 200 && !!taskId, `status=${task.status}`);

  /* ---------------------------------------------------------- validation -- */

  const noOwner = await call("GET", "/api/links", undefined, cookie);
  check("links list needs an owner", noOwner.status === 400, `status=${noOwner.status}`);

  const badKind = await call(
    "POST",
    "/api/links",
    { owner_kind: "task", owner_id: taskId, kind: "nonsense", reference: "X" },
    cookie
  );
  check("an unknown link kind is rejected", badKind.status === 400, `status=${badKind.status}`);

  const noRef = await call(
    "POST",
    "/api/links",
    { owner_kind: "task", owner_id: taskId, kind: "ticket", reference: "   " },
    cookie
  );
  check("an empty reference is rejected", noRef.status === 400, `status=${noRef.status}`);

  /* --------------------------------------------------------------- links -- */

  const created = await call(
    "POST",
    "/api/links",
    {
      owner_kind: "task",
      owner_id: taskId,
      kind: "change_request",
      reference: "CREQ-26-08-0087",
      title: "Synthetic change request",
      progress_percent: 45,
    },
    cookie
  );
  const linkId = created.json?.link?.id;
  check("created a CR reference on a task", created.status === 201 && !!linkId, `status=${created.status}`);
  check("reference is stored verbatim", created.json?.link?.reference === "CREQ-26-08-0087");
  check("progress is stored as a number", created.json?.link?.progress_percent === 45);

  const listed = await call("GET", `/api/links?owner_kind=task&owner_id=${taskId}`, undefined, cookie);
  check("the reference lists back", (listed.json?.links || []).length === 1, `count=${(listed.json?.links || []).length}`);

  const patched = await call("PATCH", `/api/links/${linkId}`, { progress_percent: 80 }, cookie);
  check("progress can be updated", patched.json?.link?.progress_percent === 80, `progress=${patched.json?.link?.progress_percent}`);

  const badProgress = await call("PATCH", `/api/links/${linkId}`, { progress_percent: 250 }, cookie);
  check("out-of-range progress is rejected", badProgress.status === 400, `status=${badProgress.status}`);

  // A project carries links too, with the same shape.
  const projects = await call("GET", "/api/projects", undefined, cookie);
  const project = (projects.json?.projects || []).find((p) => p.name === "Apollo Design System");
  const projLink = await call(
    "POST",
    "/api/links",
    { owner_kind: "project", owner_id: project.id, kind: "ticket", reference: "181772" },
    cookie
  );
  check("a project can hold a reference too", projLink.status === 201, `status=${projLink.status}`);

  const taskLinks = await call("GET", `/api/links?owner_kind=task&owner_id=${taskId}`, undefined, cookie);
  check("links are scoped to their owner", (taskLinks.json?.links || []).length === 1, `task links=${(taskLinks.json?.links || []).length}`);

  /* ------------------------------------------------------------- members -- */

  const member = await call(
    "POST",
    `/api/tasks/${taskId}/members`,
    { user_id: jane?.id, role: "member" },
    cookie
  );
  check("added a member to the task", member.status === 201, `status=${member.status}`);
  // This is the assertion that catches a missing relation: the local store has
  // to embed `user:users(...)` exactly as PostgREST would.
  check(
    "the member comes back with the person embedded",
    member.json?.member?.user?.username === "jane",
    `user=${member.json?.member?.user?.username}`
  );

  const members = await call("GET", `/api/tasks/${taskId}/members`, undefined, cookie);
  const listedMember = (members.json?.members || [])[0];
  check("members list back with the person", listedMember?.user?.name === "Jane Doe", `name=${listedMember?.user?.name}`);
  check("member keeps its role", listedMember?.role === "member", `role=${listedMember?.role}`);

  const reread = await call("PATCH", `/api/tasks/${taskId}/members/${listedMember?.id}`, { role: "owner" }, cookie);
  check("member role can change", reread.json?.member?.role === "owner", `role=${reread.json?.member?.role}`);

  const removed = await call(
    "DELETE",
    `/api/tasks/${taskId}/members/${listedMember?.id}`,
    undefined,
    cookie
  );
  check("member can be removed", removed.status === 200, `status=${removed.status}`);
  const after = await call("GET", `/api/tasks/${taskId}/members`, undefined, cookie);
  check("removal sticks", (after.json?.members || []).length === 0, `count=${(after.json?.members || []).length}`);

  const delLink = await call("DELETE", `/api/links/${linkId}`, undefined, cookie);
  check("reference can be removed", delLink.status === 200, `status=${delLink.status}`);

  console.log("");
  if (failures > 0) {
    console.error(`${failures} check(s) FAILED`);
    process.exit(1);
  }
  console.log("reference links and task members confirmed");
  process.exit(0);
})().catch((e) => {
  console.error(`  FAIL  unexpected error: ${e.message}`);
  process.exit(1);
});
