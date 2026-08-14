'use client';

import { useEffect, useState } from 'react';
import type { EmailTemplate } from '@/lib/email-templates';

interface Draft {
  name: string;
  subject: string;
  bodyHtml: string;
}

function toDraft(t: EmailTemplate): Draft {
  return { name: t.name, subject: t.subject, bodyHtml: t.bodyHtml };
}

function isDirty(t: EmailTemplate, d: Draft): boolean {
  return d.name !== t.name || d.subject !== t.subject || d.bodyHtml !== t.bodyHtml;
}

/** View and edit the coach outreach templates stored for this athlete. */
export default function EmailTemplates({ userId }: { userId: string }) {
  const [templates, setTemplates] = useState<EmailTemplate[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setTemplates(null);
    setLoadError(false);
    fetch(`/api/templates?userId=${encodeURIComponent(userId)}`)
      .then(res => (res.ok ? res.json() : null))
      .then((data: { templates?: EmailTemplate[] } | null) => {
        if (cancelled) return;
        setTemplates(data?.templates ?? []);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  function draftFor(t: EmailTemplate): Draft {
    return drafts[t.id] ?? toDraft(t);
  }

  function patchDraft(id: string, field: keyof Draft, value: string) {
    setDrafts(prev => {
      const existing = prev[id];
      if (existing) return { ...prev, [id]: { ...existing, [field]: value } };
      const source = templates?.find(t => t.id === id);
      if (!source) return prev;
      return { ...prev, [id]: { ...toDraft(source), [field]: value } };
    });
    setSavedId(null);
    setSaveError(null);
  }

  async function save(t: EmailTemplate) {
    const draft = draftFor(t);
    setSavingId(t.id);
    setSaveError(null);
    try {
      const res = await fetch('/api/templates', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: t.id,
          name: draft.name,
          subject: draft.subject,
          bodyHtml: draft.bodyHtml,
        }),
      });
      const data = (await res.json()) as { template?: EmailTemplate; error?: string };
      const saved = data.template;
      if (!res.ok || !saved) {
        setSaveError(data.error ?? 'Could not save this template.');
        return;
      }
      setTemplates(prev => (prev ?? []).map(item => (item.id === t.id ? saved : item)));
      setDrafts(prev => {
        const next = { ...prev };
        delete next[t.id];
        return next;
      });
      setSavedId(t.id);
    } catch {
      setSaveError('Could not save this template.');
    } finally {
      setSavingId(null);
    }
  }

  return (
    <section className="mt-5">
      <p className="mb-2 text-xs font-bold uppercase tracking-wider text-neutral-500">
        Email templates
      </p>
      {templates === null && !loadError && (
        <div className="space-y-2">
          <div className="h-12 animate-pulse rounded-xl bg-neutral-100" />
          <div className="h-12 animate-pulse rounded-xl bg-neutral-100" />
        </div>
      )}
      {loadError && (
        <p className="text-sm text-neutral-400">Could not load templates.</p>
      )}
      {templates && templates.length === 0 && (
        <p className="text-sm text-neutral-400">No email templates yet.</p>
      )}
      {templates && templates.length > 0 && (
        <ul className="divide-y divide-neutral-100 overflow-hidden rounded-xl border border-neutral-200">
          {templates.map(t => {
            const open = openId === t.id;
            const draft = draftFor(t);
            const dirty = isDirty(t, draft);
            return (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : t.id)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-neutral-50"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {t.name}
                      {t.isDefault && (
                        <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                          Default
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-neutral-500">{t.subject || 'No subject'}</p>
                  </div>
                  <span className="shrink-0 text-xs font-semibold text-neutral-400">
                    {open ? 'Hide' : 'Edit'}
                  </span>
                </button>
                {open && (
                  <div className="space-y-3 border-t border-neutral-100 bg-neutral-50/60 px-4 py-3">
                    <label className="block">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                        Name
                      </span>
                      <input
                        value={draft.name}
                        onChange={e => patchDraft(t.id, 'name', e.target.value)}
                        className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500"
                      />
                    </label>
                    <label className="block">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                        Subject
                      </span>
                      <input
                        value={draft.subject}
                        onChange={e => patchDraft(t.id, 'subject', e.target.value)}
                        className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500"
                      />
                    </label>
                    <label className="block">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                        Body
                      </span>
                      <textarea
                        value={draft.bodyHtml}
                        onChange={e => patchDraft(t.id, 'bodyHtml', e.target.value)}
                        rows={14}
                        spellCheck={false}
                        className="mt-1 w-full resize-y rounded-lg border border-neutral-300 bg-white px-3 py-2 font-mono text-xs leading-relaxed outline-none focus:border-emerald-500"
                      />
                    </label>
                    <div>
                      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                        Preview
                      </p>
                      <div
                        className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm leading-relaxed text-neutral-800 [&_p]:mb-2 [&_strong]:font-semibold"
                        dangerouslySetInnerHTML={{ __html: draft.bodyHtml }}
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        disabled={!dirty || savingId === t.id}
                        onClick={() => void save(t)}
                        className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:bg-neutral-200 disabled:text-neutral-400"
                      >
                        {savingId === t.id ? 'Saving' : 'Save template'}
                      </button>
                      {savedId === t.id && (
                        <span className="text-sm font-medium text-emerald-700">Saved</span>
                      )}
                      {saveError && open && (
                        <span className="text-sm font-medium text-red-600">{saveError}</span>
                      )}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
