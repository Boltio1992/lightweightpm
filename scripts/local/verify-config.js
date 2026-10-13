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

  /* ------------------------------ editing classification after creation ------ */

  // The create form sets classification once. A typo can only be corrected if
  // PATCH /api/projects/[id] exposes the same four fields the settings modal
  // now sends — otherwise a wrong reference or type is permanent.
  const editable = await call(
    "POST",
    "/api/projects",
    {
      name: `Editable classification ${stamp}`,
      status: "active",
      reference_no: "WRONG-001",
      type: "report",
      plan_class: "in_plan",
    },
    cookie
  );
  const editableId = editable.json?.project?.id;
  check("created a project to edit", editable.status === 200 && !!editableId, `status=${editable.status}`);

  const fixed = await call(
    "PATCH",
    `/api/projects/${editableId}`,
    {
      reference_no: "FIXED-002",
      type: "cr",
      plan_class: "new_request",
      request_type: "audit_regulator",
    },
    cookie
  );
  check("classification can be edited after creation", fixed.status === 200, `status=${fixed.status}`);
  check(
    "the edit stores all four fields",
    fixed.json?.project?.reference_no === "FIXED-002" &&
      fixed.json?.project?.type === "cr" &&
      fixed.json?.project?.plan_class === "new_request" &&
      fixed.json?.project?.request_type === "audit_regulator",
    `ref=${fixed.json?.project?.reference_no} type=${fixed.json?.project?.type} plan=${fixed.json?.project?.plan_class} req=${fixed.json?.project?.request_type}`
  );

  const rereadEdited = await call("GET", "/api/projects", undefined, cookie);
  const foundEdited = (rereadEdited.json?.projects ?? []).find((p) => p.id === editableId);
  check(
    "the edited classification survives a re-read",
    foundEdited?.reference_no === "FIXED-002" && foundEdited?.type === "cr",
    `ref=${foundEdited?.reference_no} type=${foundEdited?.type}`
  );

  // Request type only applies to New Request work: leaving that plan class
  // must clear it, and setting it on an In Plan project must not stick.
  const demoted = await call("PATCH", `/api/projects/${editableId}`, { plan_class: "in_plan" }, cookie);
  check(
    "leaving New Request clears the request type",
    demoted.json?.project?.request_type === null,
    `req=${demoted.json?.project?.request_type}`
  );

  const reAdded = await call("PATCH", `/api/projects/${editableId}`, { request_type: "audit_regulator" }, cookie);
  check(
    "a request type on an In Plan project does not stick",
    reAdded.json?.project?.request_type === null,
    `req=${reAdded.json?.project?.request_type}`
  );

  const cleared = await call("PATCH", `/api/projects/${editableId}`, { reference_no: "" }, cookie);
  check(
    "a blank reference clears back to not-set",
    cleared.json?.project?.reference_no === null,
    `ref=${cleared.json?.project?.reference_no}`
  );

  // Tidy up: earlier projects in this suite stay (counts are measured as
  // deltas), but these three exist only for the checks above.
  const cleanup = await Promise.all([
    call("DELETE", `/api/projects/${editableId}`, undefined, cookie),
    call("DELETE", `/api/projects/${project?.id}`, undefined, cookie),
    call("DELETE", `/api/projects/${plain.json?.project?.id}`, undefined, cookie),
  ]);
  check(
    "cleaned up the classification test projects",
    cleanup.every((r) => r.status === 200),
    `statuses=${cleanup.map((r) => r.status).join(",")}`
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
