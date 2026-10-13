"use client";

import { useCallback, useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { api } from "@/lib/api";
import {
  CONFIG_LIST_HINTS,
  CONFIG_LIST_KEYS,
  CONFIG_LIST_LABELS,
  type ConfigListKey,
} from "@/lib/configLists";
import { DEFAULT_STATUS_SET, DELIVERY_STATUS_SET, TICKET_STATUS_SET } from "@/lib/statusSets";

type Option = {
  id: string;
  list_key: string;
  value: string;
  label: string;
  sort_order: number;
};

/**
 * Configuration, not code.
 *
 * The lists here are stored data, so a label can change without a deploy. Note
 * what is NOT editable from this screen: the set of statuses a project uses.
 * Those are rows in `project_statuses` and are edited per project in Project
 * Settings, which is where the workflow actually belongs.
 */
const STATUS_VOCABULARIES = [
  {
    title: "Default (fallback)",
    note: "Used for work with no project to take statuses from.",
    set: DEFAULT_STATUS_SET,
  },
  {
    title: "Delivery",
    note: "From the legacy registers: CR, project, study and report work.",
    set: DELIVERY_STATUS_SET,
  },
  {
    title: "Ticket",
    note: "Support-style work, if any is tracked here.",
    set: TICKET_STATUS_SET,
  },
];

export default function AdminPage() {
  const [lists, setLists] = useState<Record<string, Option[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [adding, setAdding] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<{ lists: Record<string, Option[]> }>("/api/config");
      setLists(data.lists ?? {});
      setError(null);
    } catch (err: any) {
      setError(err?.message ?? "Could not load configuration");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function rename(option: Option, label: string) {
    const trimmed = label.trim();
    if (!trimmed || trimmed === option.label) {
      setDrafts((d) => ({ ...d, [option.id]: option.label }));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api(`/api/config/${option.id}`, { method: "PATCH", json: { label: trimmed } });
      await load();
    } catch (err: any) {
      setError(err?.message ?? "Could not rename");
    } finally {
      setBusy(false);
    }
  }

  async function move(option: Option, direction: -1 | 1) {
    const siblings = lists[option.list_key] ?? [];
    const index = siblings.findIndex((o) => o.id === option.id);
    const neighbour = siblings[index + direction];
    if (!neighbour) return;
    setBusy(true);
    setError(null);
    try {
      // Swap the two orders. Two writes, but there is no ordering service to
      // lean on and the list is tiny.
      await api(`/api/config/${option.id}`, {
        method: "PATCH",
        json: { sort_order: neighbour.sort_order },
      });
      await api(`/api/config/${neighbour.id}`, {
        method: "PATCH",
        json: { sort_order: option.sort_order },
      });
      await load();
    } catch (err: any) {
      setError(err?.message ?? "Could not reorder");
    } finally {
      setBusy(false);
    }
  }

  async function remove(option: Option) {
    if (
      !confirm(
        `Delete "${option.label}"?\n\nRecords already using it keep the value "${option.value}" — they just stop matching an option in this list.`
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      await api(`/api/config/${option.id}`, { method: "DELETE" });
      await load();
    } catch (err: any) {
      setError(err?.message ?? "Could not delete");
    } finally {
      setBusy(false);
    }
  }

  async function add(listKey: ConfigListKey) {
    const label = (adding[listKey] ?? "").trim();
    if (!label) return;
    setBusy(true);
    setError(null);
    try {
      await api("/api/config", { method: "POST", json: { list_key: listKey, label } });
      setAdding((a) => ({ ...a, [listKey]: "" }));
      await load();
    } catch (err: any) {
      setError(err?.message ?? "Could not add that option");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Admin"
        subtitle="The lists this workspace runs on. They are data — changing one does not need a deploy."
      />

      <div className="page-x py-5 sm:py-6">
        {error && (
          <div className="mb-4 flex items-center justify-between rounded-md border border-danger bg-dangerSoft px-4 py-3 text-xs text-danger">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-3 shrink-0 font-semibold underline">
              Dismiss
            </button>
          </div>
        )}

        {loading ? (
          <p className="text-sm text-muted">Loading configuration…</p>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-5 lg:grid-cols-3">
              {CONFIG_LIST_KEYS.map((listKey) => {
                const options = lists[listKey] ?? [];
                return (
                  <div key={listKey} className="card overflow-hidden">
                    <div className="border-b border-line bg-subtle px-4 py-2">
                      <p className="text-xs font-medium text-muted">
                        {CONFIG_LIST_LABELS[listKey]} ({options.length})
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted">{CONFIG_LIST_HINTS[listKey]}</p>
                    </div>

                    {options.length === 0 && (
                      <p className="px-4 py-6 text-center text-xs text-muted">Nothing here yet.</p>
                    )}

                    {options.map((option, index) => (
                      <div
                        key={option.id}
                        className="flex items-center gap-2 border-b border-line px-3 py-2 last:border-0"
                      >
                        <input
                          className="input min-w-0 flex-1 py-1 text-xs"
                          value={drafts[option.id] ?? option.label}
                          onChange={(e) =>
                            setDrafts((d) => ({ ...d, [option.id]: e.target.value }))
                          }
                          onBlur={(e) => rename(option, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                          }}
                          aria-label={`Label for ${option.value}`}
                        />
                        <button
                          onClick={() => move(option, -1)}
                          disabled={index === 0 || busy}
                          className="flex-none rounded px-1 text-xs text-muted transition hover:text-ink disabled:opacity-30"
                          aria-label={`Move ${option.label} up`}
                        >
                          ↑
                        </button>
                        <button
                          onClick={() => move(option, 1)}
                          disabled={index === options.length - 1 || busy}
                          className="flex-none rounded px-1 text-xs text-muted transition hover:text-ink disabled:opacity-30"
                          aria-label={`Move ${option.label} down`}
                        >
                          ↓
                        </button>
                        <button
                          onClick={() => remove(option)}
                          className="flex-none rounded px-1 text-xs text-muted transition hover:text-danger"
                          aria-label={`Delete ${option.label}`}
                        >
                          ✕
                        </button>
                      </div>
                    ))}

                    <div className="flex items-center gap-2 px-3 py-2">
                      <input
                        className="input min-w-0 flex-1 py-1 text-xs"
                        value={adding[listKey] ?? ""}
                        onChange={(e) => setAdding((a) => ({ ...a, [listKey]: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") add(listKey);
                        }}
                        placeholder={`Add to ${CONFIG_LIST_LABELS[listKey].toLowerCase()}…`}
                        aria-label={`Add to ${CONFIG_LIST_LABELS[listKey]}`}
                      />
                      <button
                        onClick={() => add(listKey)}
                        disabled={!(adding[listKey] ?? "").trim() || busy}
                        className="btn tap flex-none text-xs"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div>
              <h2 className="text-sm font-semibold text-ink">Status vocabularies</h2>
              <p className="mt-0.5 text-xs text-muted">
                Read-only here. A project&apos;s own statuses are edited in Project Settings → Workflow,
                which is where the board columns come from.
              </p>

              <div className="mt-3 grid gap-5 lg:grid-cols-3">
                {STATUS_VOCABULARIES.map((vocab) => (
                  <div key={vocab.title} className="card overflow-hidden">
                    <div className="border-b border-line bg-subtle px-4 py-2">
                      <p className="text-xs font-medium text-muted">
                        {vocab.title} ({vocab.set.length})
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted">{vocab.note}</p>
                    </div>
                    {vocab.set.map((status) => (
                      <div
                        key={status.key}
                        className="flex items-center gap-2 border-b border-line px-4 py-1.5 text-xs last:border-0"
                      >
                        <span
                          className="h-2 w-2 flex-none rounded-full"
                          style={{ backgroundColor: status.color }}
                          aria-hidden="true"
                        />
                        <span className="flex-1 truncate text-ink">{status.label}</span>
                        <code className="flex-none text-[10px] text-muted">{status.key}</code>
                        {status.is_done && (
                          <span className="flex-none rounded bg-goodSoft px-1 text-[10px] text-good">
                            done
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
