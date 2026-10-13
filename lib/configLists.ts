/**
 * The configurable lists behind the Admin screen.
 *
 * These are the small enumerations the legacy registers used. They live as DATA
 * (the `config_options` table) rather than as code, so a label can change without
 * a deploy - which is what "do not hard-code types and statuses" asks for.
 *
 * `CONFIG_SEED` is only what a fresh database starts with. The values come from
 * the vocabulary measured in the legacy workbook
 * (docs/redesign/04-evidence-appendix.md §3-4) plus the answers given for the
 * request types.
 */

export const CONFIG_LIST_KEYS = ["project_type", "plan_class", "request_type"] as const;
export type ConfigListKey = (typeof CONFIG_LIST_KEYS)[number];

export const CONFIG_LIST_LABELS: Record<ConfigListKey, string> = {
  project_type: "Project type",
  plan_class: "Plan class",
  request_type: "Request type",
};

export const CONFIG_LIST_HINTS: Record<ConfigListKey, string> = {
  project_type: "Which register this came from.",
  plan_class: "Whether the work was planned, or arrived as a new request.",
  request_type: "How a new request reached you — only used when the plan class is New Request.",
};

export type ConfigSeed = { value: string; label: string };

/** Starting values for a fresh database. Editable in Admin afterwards. */
export const CONFIG_SEED: Record<ConfigListKey, ConfigSeed[]> = {
  project_type: [
    { value: "cr", label: "CR" },
    { value: "project", label: "Project" },
    { value: "study", label: "Study" },
    { value: "report", label: "Report" },
    { value: "automation", label: "Automation" },
    { value: "operation", label: "Operation" },
  ],
  plan_class: [
    { value: "in_plan", label: "In Plan" },
    { value: "new_request", label: "New Request" },
  ],
  request_type: [
    { value: "adhoc_meeting", label: "Adhoc meeting" },
    { value: "email_informal", label: "Email / informal" },
    { value: "audit_regulator", label: "Audit / regulator" },
  ],
};

export function isConfigListKey(value: string): value is ConfigListKey {
  return (CONFIG_LIST_KEYS as readonly string[]).includes(value);
}

/**
 * The plan-class key that unlocks a request type. Named here rather than typed
 * as a literal in the form, so there is one place to change it.
 */
export const NEW_REQUEST_VALUE = "new_request";

/**
 * A stable key from whatever the user typed. The key is what gets stored on a
 * record, so renaming a label later never rewrites data.
 */
export function slugifyConfigValue(label: string): string {
  const slug = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return slug || `option_${Date.now().toString(36)}`;
}
