# Rotate the Supabase service-role key — LightPM

**Project ref:** `lkvbzkbftogwobvyjxhc`
**Endpoint:** https://lkvbzkbftogwobvyjxhc.supabase.co
**Status as of 2026-10-06:** NOT ROTATED — the leaked key is still live.

## Why
The current secret key (`sb_secret_8E-n…`) was pasted into a chat on 2026-09-29.
It grants **full database access, bypassing row-level security**. Verified still
working on 2026-10-06 (`npm run db:check` connected successfully and reported the
schema in sync: 7 tables / 63 columns).

## Checklist

- [ ] **1. Rotate in Supabase**
      Dashboard → project `lkvbzkbftogwobvyjxhc` → **Project Settings → API keys** →
      rotate / create a new **secret key (service_role)**, revoke the old one.

- [ ] **2. Update local env**
      `C:/Users/DELL/WorkBuddy AI/lightweightpm/.env.local`
      ```
      SUPABASE_SERVICE_ROLE_KEY=<new key>
      ```
      (Or paste the new value in chat and I'll edit the file.)

- [ ] **3. Update Vercel — or production breaks**
      Project → **Settings → Environment Variables** → `SUPABASE_SERVICE_ROLE_KEY`
      → set for **Production + Preview + Development**, then **Redeploy**.

- [ ] **4. Verify**
      ```bash
      cd "C:/Users/DELL/WorkBuddy AI/lightweightpm"
      npm run db:check
      ```
      Expect: `In sync — every expected table and column exists in the database.`

## Notes
- Other env vars on Vercel: `SUPABASE_URL`, `SESSION_SECRET`. Rotating the service
  key does not affect user sessions (auth is the app's own cookie/JWT).
- Only server-side code uses this key (`lib/supabaseServer.ts` → `supabaseAdmin()`);
  it is never shipped to the browser, so no client rebuild is needed beyond the redeploy.
