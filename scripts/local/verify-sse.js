/**
 * End-to-end test for live updates (SSE).
 *
 *   1. logs in and keeps the session cookie
 *   2. opens /api/events and waits for the "ready" frame
 *   3. performs a real write (creates a project) over the API
 *   4. asserts a "change" frame arrives for that write
 *
 * A pass here means a second browser window would have been refreshed.
 *
 * usage: node verify-sse.js [baseUrl]
 */

const BASE = process.argv[2] || "http://localhost:3000";
const USERNAME = "admin";
const PASSWORD = "password123";
const DEADLINE_MS = 20000;

function fail(msg) {
  console.error(`  FAIL  ${msg}`);
  process.exit(1);
}

function ok(msg) {
  console.log(`  PASS  ${msg}`);
}

(async () => {
  console.log(`=== live update (SSE) check against ${BASE} ===`);

  const login = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
  });
  if (login.status !== 200) fail(`login returned ${login.status}`);

  const setCookie = login.headers.getSetCookie
    ? login.headers.getSetCookie()
    : [login.headers.get("set-cookie")];
  const cookie = (setCookie || []).filter(Boolean).map((c) => c.split(";")[0]).join("; ");
  if (!cookie) fail("login returned no session cookie");
  ok("logged in and captured the session cookie");

  const controller = new AbortController();
  const stream = await fetch(`${BASE}/api/events`, {
    headers: { cookie, accept: "text/event-stream" },
    signal: controller.signal,
  });

  if (stream.status !== 200) fail(`/api/events returned ${stream.status}`);
  const contentType = stream.headers.get("content-type") || "";
  if (!contentType.includes("text/event-stream")) {
    fail(`/api/events content-type was "${contentType}"`);
  }
  ok("SSE stream opened with text/event-stream");

  const reader = stream.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let sawReady = false;
  let sawChangeForProjects = false;
  let readyResolve;
  const ready = new Promise((r) => (readyResolve = r));

  const readLoop = (async () => {
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let sep;
        while ((sep = buffer.indexOf("\n\n")) !== -1) {
          const frame = buffer.slice(0, sep);
          buffer = buffer.slice(sep + 2);

          const eventLine = frame.split("\n").find((l) => l.startsWith("event: "));
          const dataLine = frame.split("\n").find((l) => l.startsWith("data: "));
          const event = eventLine ? eventLine.slice(7).trim() : "message";
          const data = dataLine ? dataLine.slice(6) : null;

          if (event === "ready") {
            sawReady = true;
            readyResolve();
          }
          if (event === "change" && data) {
            try {
              const parsed = JSON.parse(data);
              if (parsed.table === "projects") sawChangeForProjects = true;
            } catch {
              /* ignore malformed frame */
            }
          }
        }
      }
    } catch {
      /* aborted at the end of the test */
    }
  })();

  const readyTimer = setTimeout(() => readyResolve(), DEADLINE_MS);
  await ready;
  clearTimeout(readyTimer);
  if (!sawReady) fail("never received the ready frame");
  ok("received the ready frame");

  // Real write, from a different client than the one reading the stream.
  const stamp = new Date().toISOString().slice(11, 19);
  const create = await fetch(`${BASE}/api/projects`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ name: `SSE Live Test ${stamp}`, status: "active" }),
  });
  if (create.status !== 200) fail(`creating a project returned ${create.status}`);
  ok("created a project to trigger a change");

  const deadline = Date.now() + DEADLINE_MS;
  while (!sawChangeForProjects && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 150));
  }

  controller.abort();
  await readLoop.catch(() => {});

  if (!sawChangeForProjects) fail("no change event for the projects table arrived");
  ok("received a change event for the projects table");

  console.log("\nlive updates confirmed");
  process.exit(0);
})().catch((e) => {
  console.error(`  FAIL  unexpected error: ${e.message}`);
  process.exit(1);
});
