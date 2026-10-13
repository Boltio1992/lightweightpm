"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { LINK_KINDS, LINK_KIND_LABELS, LINK_KIND_SHORT } from "@/lib/links";
import type { ExternalLink, LinkOwnerKind } from "@/types";

/**
 * References out to Ticket / Change Request / Change Release.
 *
 * Our own record of the link is `kind` + `reference`; `title` and `progress` are
 * typed in for the demo because there is nothing to query yet. Once those
 * systems are reachable the same fields are refreshed in place and this component
 * does not change - it only ever reads them. See docs/redesign/06-ux-design.md §8.
 */
export default function ReferenceLinks({
  ownerKind,
  ownerId,
}: {
  ownerKind: LinkOwnerKind;
  ownerId: string;
}) {
  const [links, setLinks] = useState<ExternalLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const [kind, setKind] = useState<string>(LINK_KINDS[0]);
  const [reference, setReference] = useState("");
  const [title, setTitle] = useState("");
  const [progress, setProgress] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<{ links: ExternalLink[] }>(
        `/api/links?owner_kind=${ownerKind}&owner_id=${encodeURIComponent(ownerId)}`
      );
      setLinks(data.links ?? []);
    } catch (err: any) {
      setError(err?.message ?? "Could not load references");
    } finally {
      setLoading(false);
    }
  }, [ownerKind, ownerId]);

  useEffect(() => {
    load();
  }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!reference.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await api("/api/links", {
        method: "POST",
        json: {
          owner_kind: ownerKind,
          owner_id: ownerId,
          kind,
          reference: reference.trim(),
          title: title.trim() || null,
          progress_percent: progress === "" ? null : Number(progress),
        },
      });
      setReference("");
      setTitle("");
      setProgress("");
      setAdding(false);
      await load();
    } catch (err: any) {
      setError(err?.message ?? "Could not save the reference");
    } finally {
      setSaving(false);
    }
  }

  async function remove(link: ExternalLink) {
    if (!confirm(`Remove the link to ${link.reference}?`)) return;
    await api(`/api/links/${link.id}`, { method: "DELETE" }).catch(() => {});
    await load();
  }

  async function copy(link: ExternalLink) {
    try {
      await navigator.clipboard.writeText(link.reference);
      setCopied(link.id);
      setTimeout(() => setCopied((c) => (c === link.id ? null : c)), 1500);
    } catch {
      // Clipboard unavailable; the reference is visible on screen anyway.
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-ink">
            References{links.length > 0 ? ` (${links.length})` : ""}
          </p>
          <p className="mt-0.5 text-xs text-muted">
            Ticket, change request or change release this belongs to.
          </p>
        </div>
        <button onClick={() => setAdding((v) => !v)} className="btn tap text-xs">
          {adding ? "Cancel" : "Add reference"}
        </button>
      </div>

      {loading ? (
        <p className="text-xs text-muted">Loading…</p>
      ) : links.length === 0 && !adding ? (
        <p className="text-xs text-muted italic">No references yet.</p>
      ) : (
        <div className="divide-y divide-line overflow-hidden rounded-md border border-line">
          {links.map((link) => (
            <div key={link.id} className="flex items-center gap-3 px-3 py-2">
              <span
                className="flex-none rounded border border-line bg-subtle px-1.5 py-0.5 text-[10px] font-semibold text-muted"
                title={LINK_KIND_LABELS[link.kind] ?? link.kind}
              >
                {LINK_KIND_SHORT[link.kind] ?? link.kind}
              </span>

              <button
                onClick={() => copy(link)}
                className="flex-none font-mono text-xs text-ink hover:text-accent"
                title="Copy this reference"
              >
                {link.reference}
              </button>

              <span className="min-w-0 flex-1 truncate text-xs text-muted" title={link.title ?? ""}>
                {link.title || "—"}
              </span>

              {link.progress_percent === null ? (
                <span className="flex-none text-xs text-muted">—</span>
              ) : (
                <span className="flex flex-none items-center gap-1.5">
                  <span className="h-1 w-8 flex-none overflow-hidden rounded-full bg-subtle">
                    <span
                      className="block h-full rounded-full bg-accent"
                      style={{ width: `${link.progress_percent}%` }}
                    />
                  </span>
                  <span className="w-8 text-right text-xs text-muted">{link.progress_percent}%</span>
                </span>
              )}

              <button
                onClick={() => remove(link)}
                className="flex-none text-xs text-muted transition hover:text-danger"
                aria-label={`Remove reference ${link.reference}`}
              >
                ✕
              </button>

              {copied === link.id && <span className="flex-none text-[10px] text-accent">copied</span>}
            </div>
          ))}
        </div>
      )}

      {adding && (
        <form onSubmit={add} className="space-y-3 rounded-md border border-line p-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Kind</label>
              <select className="input" value={kind} onChange={(e) => setKind(e.target.value)}>
                {LINK_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {LINK_KIND_LABELS[k] ?? k}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Reference</label>
              <input
                className="input font-mono"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="181772 or CREQ-26-08-0087"
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Title (optional)</label>
              <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div>
              <label className="label">Progress % (optional)</label>
              <input
                className="input"
                type="number"
                min={0}
                max={100}
                value={progress}
                onChange={(e) => setProgress(e.target.value)}
              />
            </div>
          </div>
          <button className="btn-primary tap w-full text-xs" disabled={saving}>
            {saving ? "Saving…" : "Add reference"}
          </button>
        </form>
      )}

      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
