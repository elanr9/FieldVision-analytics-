import { NextResponse } from 'next/server';
import {
  loadStepConversions,
  type DropOffRow,
  type OnboardingKpis,
} from '@/lib/onboarding-analytics';
import { generateOnboardingInsights } from '@/lib/onboarding-insights';

export const dynamic = 'force-dynamic';

interface Body {
  kpis?: OnboardingKpis;
  dropOff?: DropOffRow[];
  rangeLabel?: string;
  fromIso?: string;
  toIso?: string;
}

export async function POST(request: Request) {
  const body = (await request.json()) as Body;
  if (!body.kpis || !body.dropOff || !body.rangeLabel) {
    return NextResponse.json({ error: 'Missing payload' }, { status: 400 });
  }

  const insights = await generateOnboardingInsights({
    kpis: body.kpis,
    dropOff: body.dropOff,
    rangeLabel: body.rangeLabel,
  });

  let conversions: Awaited<ReturnType<typeof loadStepConversions>> = [];
  if (body.fromIso && body.toIso) {
    try {
      conversions = await loadStepConversions(body.fromIso, body.toIso);
    } catch {
      conversions = [];
    }
  }

  return NextResponse.json({ ...insights, conversions });
}
