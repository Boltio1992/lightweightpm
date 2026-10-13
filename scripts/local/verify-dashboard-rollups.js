/**
 * Verifies the dashboard classification rollups (phase 6).
 *
 * The interesting assertion is the last one: renaming an option in Admin must
 * change the label the dashboard shows. That is what proves the rollup reads the
 * configurable list rather than a hard-coded set of names.
 *
 * Counts are measured as deltas, because the dashboard totals every project.
 *
 * usage: node scripts/local/verify-dashboard-rollups.js [baseUrl]
 */

const BASE = process.argv[2] || "http://localhost:3000";

let failures = 0;

function check(label, ok, detail = "") {
  if (ok) {
    console.log(`  PASS  ${label.padEnd(58)} ${detail}`);
  } else {
    failures += 1;
    console.error(`  FAIL  ${label.padEnd(58)} ${detail}`);
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

function countFor(rows, key) {
  return (rows ?? []).find((r) => r.key === key)?.count ?? 0;
}

function labelFor(rows, key) {
  return (rows ?? []).find((r) => r.key === key)?.label ?? null;
}

(async () => {
  console.log(`=== dashboard classification rollups against ${BASE} ===`);

  const login = await call("POST", "/api/auth/login", {
    username: "admin",
    password: "password123",
  });
  if (login.status !== 200) {
    console.error(`  FAIL  login returned ${login.status}`);
    process.exit(1);
  }
  const cookie = login.setCookie.map((c) => c.split(";")[0]).join("; ");

  const before = await call("GET", "/api/dashboard", undefined, cookie);
  check("dashboard loads", before.status === 200, `status=${before.status}`);
  const b = before.json?.classification;
  check("classification rollups are present", !!b?.byType && !!b?.byPlanClass);
  check(
    "unclassified projects are counted, not dropped",
    countFor(b?.byType, "") > 0,
    `not set=${countFor(b?.byType, "")}`
  );
  check(
    "the unclassified bucket reads 'Not set'",
    labelFor(b?.byType, "") === "Not set",
    `label=${labelFor(b?.byType, "")}`
  );

  const baseCr = countFor(b?.byType, "cr");
  const baseReport = countFor(b?.byType, "report");
  const basePlan = countFor(b?.byPlanClass, "in_plan");
  const baseNew = countFor(b?.byPlanClass, "new_request");

  const stamp = Date.now().toString().slice(-6);
  const spec = [
    { name: `Rollup CR A ${stamp}`, type: "cr", plan_class: "in_plan" },
    { name: `Rollup CR B ${stamp}`, type: "cr", plan_class: "new_request" },
    { name: `Rollup report ${stamp}`, type: "report", plan_class: "in_plan" },
  ];

  for (const project of spec) {
    const res = await call("POST", "/api/projects", { ...project, status: "active" }, cookie);
    if (res.status !== 200) {
      console.error(`  FAIL  could not create ${project.name}: ${res.status}`);
      process.exit(1);
    }
  }
  check("created classified projects", true, `n=${spec.length}`);

  const after = await call("GET", "/api/dashboard", undefined, cookie);
  const a = after.json?.classification;

  check(
    "byType counts the new CR projects",
    countFor(a?.byType, "cr") === baseCr + 2,
    `${baseCr} -> ${countFor(a?.byType, "cr")}`
  );
  check(
    "byType counts the new report project",
    countFor(a?.byType, "report") === baseReport + 1,
    `${baseReport} -> ${countFor(a?.byType, "report")}`
  );
  check(
    "byPlanClass counts In Plan",
    countFor(a?.byPlanClass, "in_plan") === basePlan + 2,
    `${basePlan} -> ${countFor(a?.byPlanClass, "in_plan")}`
  );
  check(
    "byPlanClass counts New Request",
    countFor(a?.byPlanClass, "new_request") === baseNew + 1,
    `${baseNew} -> ${countFor(a?.byPlanClass, "new_request")}`
  );
  check("the CR label comes from config", labelFor(a?.byType, "cr") === "CR", `label=${labelFor(a?.byType, "cr")}`);

  /* ---------------- labels follow Admin, not a hard-coded list ------------- */

  const config = await call("GET", "/api/config", undefined, cookie);
  const crOption = (config.json?.lists?.project_type ?? []).find((o) => o.value === "cr");
  check("found the CR config option", !!crOption, `id=${crOption?.id}`);

  const renamed = await call("PATCH", `/api/config/${crOption.id}`, { label: "Change Request" }, cookie);
  check("renamed the option in Admin", renamed.status === 200, `status=${renamed.status}`);

  const afterRename = await call("GET", "/api/dashboard", undefined, cookie);
  check(
    "the dashboard shows the renamed label",
    labelFor(afterRename.json?.classification?.byType, "cr") === "Change Request",
    `label=${labelFor(afterRename.json?.classification?.byType, "cr")}`
  );
  check(
    "renaming did not change the count",
    countFor(afterRename.json?.classification?.byType, "cr") === countFor(a?.byType, "cr"),
    `count=${countFor(afterRename.json?.classification?.byType, "cr")}`
  );

  // Put it back so a re-run starts from the seed state.
  await call("PATCH", `/api/config/${crOption.id}`, { label: "CR" }, cookie);
  check("restored the original label", true);

  console.log("");
  if (failures > 0) {
    console.error(`${failures} check(s) FAILED`);
    process.exit(1);
  }
  console.log("dashboard classification rollups confirmed");
  process.exit(0);
})().catch((e) => {
  console.error(`  FAIL  unexpected error: ${e.message}`);
  process.exit(1);
});
