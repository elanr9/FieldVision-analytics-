'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  computeChapterRollup,
  computeDropOff,
  computeOnboardingKpis,
  type StepConversion,
} from '@/lib/onboarding-analytics';
import type { UserRecord } from '@/lib/types';

export default function OnboardingAnalytics({
  cohort,
  rangeLabel,
  from,
  to,
}: {
  cohort: UserRecord[];
  rangeLabel: string;
  from: Date;
  to: Date;
}) {
  const kpis = useMemo(() => computeOnboardingKpis(cohort), [cohort]);
  const dropOff = useMemo(() => computeDropOff(cohort), [cohort]);
  const chapters = useMemo(() => computeChapterRollup(dropOff), [dropOff]);
  const maxDrop = dropOff[0]?.count ?? 0;

  const [insight, setInsight] = useState<string | null>(null);
  const [insightLoading, setInsightLoading] = useState(true);
  const [conversions, setConversions] = useState<StepConversion[]>([]);

  useEffect(() => {
    let cancelled = false;
    setInsightLoading(true);
    fetch('/api/onboarding-insights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kpis,
        dropOff,
        rangeLabel,
        fromIso: from.toISOString(),
        toIso: to.toISOString(),
      }),
    })
      .then(res => (res.ok ? res.json() : null))
      .then(
        (data: { summary?: string; conversions?: StepConversion[] } | null) => {
          if (cancelled) return;
          setInsight(data?.summary ?? null);
          setConversions(data?.conversions ?? []);
        },
      )
      .catch(() => {
        if (!cancelled) {
          setInsight(null);
          setConversions([]);
        }
      })
      .finally(() => {
        if (!cancelled) setInsightLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [kpis, dropOff, rangeLabel, from, to]);

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-neutral-500">
          Onboarding · {rangeLabel}
        </h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: 'Started', value: kpis.started },
            { label: 'Completed', value: kpis.completed },
            { label: 'In progress', value: kpis.inProgress },
            { label: 'Completion', value: `${kpis.completionRate}%` },
          ].map(card => (
            <div
              key={card.label}
              className="rounded-2xl border border-neutral-200 bg-white p-3"
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                {card.label}
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{card.value}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-neutral-500">
          AI read
        </h2>
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
          {insightLoading ? (
            <div className="space-y-1.5">
              <div className="h-3 w-full animate-pulse rounded bg-emerald-100" />
              <div className="h-3 w-4/5 animate-pulse rounded bg-emerald-100" />
            </div>
          ) : (
            <p className="text-sm leading-relaxed text-neutral-800">
              {insight ?? 'Could not load onboarding insights.'}
            </p>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-neutral-500">
          Where people stop
        </h2>
        {dropOff.length === 0 ? (
          <p className="text-sm text-neutral-500">No one is stuck in onboarding for this range.</p>
        ) : (
          <ul className="space-y-2">
            {dropOff.map(row => (
              <li
                key={row.stepId}
                className="rounded-2xl border border-neutral-200 bg-white p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium text-neutral-500">
                      {row.chapterLabel} · {row.stepId}
                    </p>
                    <p className="mt-0.5 text-sm font-semibold leading-snug">{row.label}</p>
                  </div>
                  <p className="shrink-0 text-lg font-bold tabular-nums">{row.count}</p>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-100">
                  <div
                    className="h-full rounded-full bg-amber-500"
                    style={{ width: `${maxDrop ? (row.count / maxDrop) * 100 : 0}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-neutral-500">
          By chapter
        </h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {chapters.map(ch => (
            <div
              key={ch.chapter}
              className="rounded-2xl border border-neutral-200 bg-white p-3"
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                {ch.label}
              </p>
              <p className="mt-1 text-xl font-bold tabular-nums">{ch.count}</p>
              <p className="text-[11px] text-neutral-500">stuck</p>
            </div>
          ))}
        </div>
      </section>

      {conversions.length > 0 && (
        <section>
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-neutral-500">
            Step conversion
          </h2>
          <p className="mb-2 text-xs text-neutral-500">
            From product events: viewed to completed in this range.
          </p>
          <ul className="divide-y divide-neutral-100 rounded-2xl border border-neutral-200 bg-white">
            {conversions.slice(0, 12).map(row => (
              <li key={row.stepId} className="flex items-center gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{row.label}</p>
                  <p className="text-[11px] text-neutral-500">
                    {row.viewed} viewed · {row.completed} completed
                  </p>
                </div>
                <p className="shrink-0 text-sm font-bold tabular-nums">{row.conversionRate}%</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
