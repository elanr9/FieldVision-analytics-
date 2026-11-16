#!/usr/bin/env node
/**
 * Regenerates lib/onboarding-flow.generated.ts from the athlete apps' onboarding flow config.
 *
 *   node scripts/sync-onboarding-flow.mjs           rewrite the mirror
 *   node scripts/sync-onboarding-flow.mjs --check   exit 1 when the mirror is stale
 *
 * Two flows are mirrored, because both have been live and the web app switches between them:
 *   classic  src/flow/sections/sectionN.tsx (s01 … s36b), then the paywall
 *   short    src/flow/sections/intake.tsx (n00 … n11) and the p-screens of paywall.tsx, then the paywall
 * Both end on the same paywall tail (s37_paywall, its overlays, s38_welcome).
 *
 * The apps are expected as sibling checkouts of this repo; override with INKBOUND_WEB / INKBOUND_MOBILE.
 * inkbound-web is read from a git ref (INKBOUND_WEB_REF, default origin/main, i.e. what is deployed) so
 * half-finished work in its working tree never reaches the dashboard. Set INKBOUND_WEB_REF=WORKTREE to
 * read the files on disk instead. inkbound-mobile is read from disk.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');
const OUTPUT = join(repoRoot, 'lib', 'onboarding-flow.generated.ts');
const SECTIONS_DIR = 'src/flow/sections';

const WEB_DIR = process.env.INKBOUND_WEB ?? resolve(repoRoot, '..', 'inkbound-web');
const MOBILE_DIR = process.env.INKBOUND_MOBILE ?? resolve(repoRoot, '..', 'inkbound-mobile');
const WEB_REF = process.env.INKBOUND_WEB_REF ?? 'origin/main';

const ID = "[a-z]\\d+[a-z]?_[a-z0-9_]+";
const SCREEN_ENTRY = new RegExp(`\\{\\s*id:\\s*'(${ID})'(?<body>[\\s\\S]*?)\\}(?=\\s*,?\\s*(?:\\{|\\]))`, 'g');
const MANUAL_VIEW = new RegExp(`trackScreenView\\('(${ID})'\\)`, 'g');
const SINGLE_SCREEN = new RegExp(`export const \\w+_SCREEN: FlowScreen = \\{\\s*id:\\s*'(${ID})'`, 'g');

/** Sort key for ids like s19b_on_track → [19, 'b']. */
function orderKey(id) {
  const m = /^[a-z](\d+)([a-z]?)_/.exec(id);
  return m ? [Number(m[1]), m[2]] : [Number.MAX_SAFE_INTEGER, ''];
}

function compareIds(a, b) {
  const [na, la] = orderKey(a), [nb, lb] = orderKey(b);
  return na - nb || la.localeCompare(lb);
}

function git(dir, args) {
  return execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 });
}

/** A way to list and read one app's section files, or null when the app is not checked out. */
function openApp(dir, ref) {
  if (!existsSync(join(dir, SECTIONS_DIR))) return null;
  if (ref && ref !== 'WORKTREE') {
    try {
      const names = git(dir, ['ls-tree', '--name-only', `${ref}:${SECTIONS_DIR}`]).split('\n').filter(Boolean);
      return { name: `${dir.split('/').pop()}@${ref}`, names, read: name => git(dir, ['show', `${ref}:${SECTIONS_DIR}/${name}`]) };
    } catch {
      // Not a git checkout, or the ref does not exist there: fall through to the files on disk.
    }
  }
  const sections = join(dir, SECTIONS_DIR);
  return { name: dir.split('/').pop(), names: readdirSync(sections).sort(), read: name => readFileSync(join(sections, name), 'utf8') };
}

/** Screens declared in the array named `arrayName`, in file order. */
function arrayScreens(src, arrayName) {
  const start = src.indexOf(`${arrayName}: FlowScreen[]`);
  if (start < 0) return [];
  const end = src.indexOf('\n];', start);
  const body = src.slice(start, end < 0 ? undefined : end + 3);
  return [...body.matchAll(SCREEN_ENTRY)].map(m => ({ id: m[1], conditional: /\bvisible\s*:/.test(m.groups.body) }));
}

/** Screens a file reports only through trackScreenView (overlays) or exports on their own. */
function looseScreens(src, known) {
  const out = [];
  for (const re of [MANUAL_VIEW, SINGLE_SCREEN]) {
    for (const m of src.matchAll(re)) {
      if (!known.has(m[1]) && !out.some(s => s.id === m[1])) out.push({ id: m[1], conditional: true });
    }
  }
  return out;
}

/** The classic flow of one app: every sectionN.tsx, plus the s-screens of the standalone paywall files. */
function classicScreens(app) {
  const screens = new Map();
  const add = (s, section) => { if (!screens.has(s.id)) screens.set(s.id, { ...s, section }); };
  for (const name of app.names) {
    const m = /^section(\d+)\.tsx$/.exec(name);
    if (!m) continue;
    const src = app.read(name);
    const section = Number(m[1]);
    const declared = arrayScreens(src, `SECTION${section}_SCREENS`);
    for (const s of declared) add(s, section);
    for (const s of looseScreens(src, new Set(declared.map(d => d.id)))) add(s, section);
  }
  for (const name of ['paywall.tsx', 'parentPay.tsx']) {
    if (!app.names.includes(name)) continue;
    const src = app.read(name);
    const declared = arrayScreens(src, 'PAYWALL_SCREENS').filter(s => s.id.startsWith('s'));
    for (const s of [...declared, ...looseScreens(src, new Set())]) if (s.id.startsWith('s')) add(s, 7);
  }
  return [...screens.values()];
}

/** The short flow: the intake, the plan pitch, then the paywall tail shared with the classic flow. */
function shortScreens(app, classic) {
  if (!app.names.includes('intake.tsx')) return [];
  const intake = arrayScreens(app.read('intake.tsx'), 'INTAKE_SCREENS').map(s => ({ ...s, section: 1 }));
  if (intake.length === 0) return [];
  const pitch = app.names.includes('paywall.tsx')
    ? arrayScreens(app.read('paywall.tsx'), 'PAYWALL_SCREENS').filter(s => !s.id.startsWith('s')).map(s => ({ ...s, section: 2 }))
    : [];
  const tail = classic.filter(s => orderKey(s.id)[0] >= 37).map(s => ({ ...s, section: 3 }));
  return [...intake, ...pitch, ...tail];
}

export function collectScreens() {
  const web = openApp(WEB_DIR, WEB_REF);
  const mobile = openApp(MOBILE_DIR, null);
  const sources = [web, mobile].filter(Boolean).map(a => a.name);

  const merged = new Map();
  for (const app of [web, mobile]) {
    if (!app) continue;
    for (const s of classicScreens(app)) {
      const existing = merged.get(s.id);
      // A screen is conditional only when every app that has it marks it conditional.
      merged.set(s.id, existing ? { ...existing, conditional: existing.conditional && s.conditional } : s);
    }
  }
  const screens = [...merged.values()].sort((a, b) => a.section - b.section || compareIds(a.id, b.id));
  return { screens, short: web ? shortScreens(web, screens) : [], sources };
}

function rows(list) {
  return list.map(s => `  { id: '${s.id}', section: ${s.section}, conditional: ${s.conditional} },`).join('\n');
}

export function render({ screens, short, sources }) {
  return `/**
 * GENERATED by scripts/sync-onboarding-flow.mjs. Do not edit by hand.
 * Mirror of the athlete apps' onboarding flows (src/flow/sections) so the funnel follows the live screens.
 * Sources: ${sources.join(', ')}.
 */
export interface FlowScreenDef {
  /** Screen id as emitted in product_events (onboarding_screen_view / onboarding_answer). */
  id: string;
  /** Section number within its flow. */
  section: number;
  /** Shown only for some answers, so fewer people reaching it is not a drop. */
  conditional: boolean;
}

/** The classic flow: sections 1 to 7 of FLOW.md. */
export const FLOW_SCREEN_DEFS: FlowScreenDef[] = [
${rows(screens)}
];

/** The short flow: 1 intake, 2 plan pitch, 3 the paywall tail it shares with the classic flow. */
export const SHORT_FLOW_SCREEN_DEFS: FlowScreenDef[] = [
${rows(short)}
];
`;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const collected = collectScreens();
  if (collected.sources.length === 0) {
    console.error('No athlete app checkout found. Expected ../inkbound-web or ../inkbound-mobile (or INKBOUND_WEB / INKBOUND_MOBILE).');
    process.exit(2);
  }
  const next = render(collected);
  const current = existsSync(OUTPUT) ? readFileSync(OUTPUT, 'utf8') : '';
  if (process.argv.includes('--check')) {
    if (current !== next) {
      console.error(`${OUTPUT} is stale. Run: node scripts/sync-onboarding-flow.mjs`);
      process.exit(1);
    }
    console.log(`onboarding flow mirror is in sync (${collected.screens.length} classic, ${collected.short.length} short screens).`);
  } else {
    writeFileSync(OUTPUT, next);
    console.log(`Wrote ${collected.screens.length} classic and ${collected.short.length} short screens to ${OUTPUT}`);
  }
}
