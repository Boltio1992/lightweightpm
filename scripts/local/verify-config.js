/**
 * Verifies phase 5: the configurable lists and the classification they drive.
 *
 * Two things are being proved here. First that a fresh database seeds the lists
 * (so the Admin screen is never empty). Second - the part that matters - that a
 * project created with `type` / `plan_class` / `request_type` actually stores
 * those keys, because phase 1 added the columns and nothing wrote them until now.
 *
 * usage: node scripts/local/verify-config.js [baseUrl]
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
  console.log(`=== configurable lists + classification against ${BASE} ===`);

  const login = await call("POST", "/api/auth/login", {
    username: "admin",
    password: "password123",
  });
  if (login.status !== 200) {
    console.error(`  FAIL  login returned ${login.status}`);
    process.exit(1);
  }
  const cookie = login.setCookie.map((c) => c.split(";")[0]).join("; ");

  /* ------------------------------------------------------------- seeding -- */

  const config = await call("GET", "/api/config", undefined, cookie);
  const lists = config.json?.lists ?? {};
  check("config lists load", config.status === 200, `status=${config.status}`);
  check("project types are seeded", (lists.project_type ?? []).length >= 5, `n=${(lists.project_type ?? []).length}`);
  check("plan classes are seeded", (lists.plan_class ?? []).length === 2, `n=${(lists.plan_class ?? []).length}`);
  check("request types are seeded", (lists.request_type ?? []).length >= 3, `n=${(lists.request_type ?? []).length}`);

  const typeLabels = (lists.project_type ?? []).map((o) => o.label);
  check("the CR type is present", typeLabels.includes("CR"), `labels=${typeLabels.join(",")}`);
  const planLabels = (lists.plan_class ?? []).map((o) => o.label);
  check(
    "In Plan / New Request are present",
    planLabels.includes("In Plan") && planLabels.includes("New Request"),
    `labels=${planLabels.join(",")}`
  );

  /* ------------------------------------------------------------ managing -- */

  const added = await call(
    "POST",
    "/api/config",
    { list_key: "request_type", label: "Walk-in" },
    cookie
  );
  const addedId = added.json?.option?.id;
  check("an option can be added", added.status === 201 && !!addedId, `status=${added.status}`);
  check(
    "the key is derived from the label",
    added.json?.option?.value === "walk_in",
    `value=${added.json?.option?.value}`
  );

  const dup = await call(
    "POST",
    "/api/config",
    { list_key: "request_type", label: "Walk-in" },
    cookie
  );
  check("a duplicate option is refused", dup.status === 409, `status=${dup.status}`);

  const badList = await call("POST", "/api/config", { list_key: "nonsense", label: "X" }, cookie);
  check("an unknown list is refused", badList.status === 400, `status=${badList.status}`);

  const renamed = await call("PATCH", `/api/config/${addedId}`, { label: "Walk-in visit" }, cookie);
  check("a label can be renamed", renamed.json?.option?.label === "Walk-in visit", `label=${renamed.json?.option?.label}`);
  check("renaming leaves the key alone", renamed.json?.option?.value === "walk_in", `value=${renamed.json?.option?.value}`);

  const reordered = await call("PATCH", `/api/config/${addedId}`, { sort_order: 0 }, cookie);
  check("an option can be reordered", reordered.json?.option?.sort_order === 0, `order=${reordered.json?.option?.sort_order}`);

  const deleted = await call("DELETE", `/api/config/${addedId}`, undefined, cookie);
  check("an option can be deleted", deleted.status === 200, `status=${deleted.status}`);

  /* ------------------------------------------------- classification flows -- */

  const stamp = Date.now().toString().slice(-6);
  const created = await call(
    "POST",
    "/api/projects",
    {
      name: `Classified project ${stamp}`,
      description: "Phase 5 verification",
      status: "active",
      reference_no: "PRO-25-08-0012",
      type: "cr",
      plan_class: "new_request",
      request_type: "adhoc_meeting",
    },
    cookie
  );
  const project = created.json?.project;
  check("a project with classification is created", created.status === 200 && !!project?.id, `status=${created.status}`);
  check("reference_no is stored", project?.reference_no === "PRO-25-08-0012", `ref=${project?.reference_no}`);
  check("type is stored", project?.type === "cr", `type=${project?.type}`);
  check("plan_class is stored", project?.plan_class === "new_request", `plan=${project?.plan_class}`);
  check("request_type is stored", project?.request_type === "adhoc_meeting", `req=${project?.request_type}`);

  const reread = await call("GET", "/api/projects", undefined, cookie);
  const found = (reread.json?.projects ?? []).find((p) => p.id === project?.id);
  check("classification survives a re-read", found?.type === "cr" && found?.plan_class === "new_request", `type=${found?.type}`);
  check(
    "a dropped-column warning is NOT reported",
    !(created.json?.droppedColumns ?? []).length,
    `dropped=${JSON.stringify(created.json?.droppedColumns ?? [])}`
  );

  const plain = await call(
    "POST",
    "/api/projects",
    { name: `Unclassified project ${stamp}`, status: "active" },
    cookie
  );
  check(
    "classification stays optional",
    plain.status === 200 && !plain.json?.project?.type,
    `type=${plain.json?.project?.type ?? "null"}`
  );

  console.log("");
  if (failures > 0) {
    console.error(`${failures} check(s) FAILED`);
    process.exit(1);
  }
  console.log("configurable lists and classification confirmed");
  process.exit(0);
})().catch((e) => {
  console.error(`  FAIL  unexpected error: ${e.message}`);
  process.exit(1);
});
