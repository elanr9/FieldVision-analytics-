import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { UserRecord } from './types';
import type { UserDossier } from './user-dossier';
// @ts-expect-error TS5097: node needs the .ts extension to resolve this module, tsconfig does not allow it
import { buildProfile, buildThread, formatAgo, planLabel } from './profile.ts';

// Tuesday Sep 8, 2026.
const NOW = new Date('2026-09-08T12:00:00');

function user(overrides: Partial<UserRecord>): UserRecord {
  return {
    id: 'u1',
    name: 'Maya Okafor',
    email: 'maya.okafor@gmail.com',
    phone: '+1 (214) 555-0142',
    team: 'Solar SC',
    position: 'CM',
    gradYear: 2027,
    parentName: null,
    parentEmail: null,
    signupDate: '2026-08-17T10:00:00',
    trialStartedAt: '2026-08-17T10:00:00',
    trialEndsAt: '2026-08-24T10:00:00',
    paidAt: '2026-08-24T10:00:00',
    paymentType: 'monthly_29_99',
    status: 'paying',
    interval: 'monthly',
    isParent: false,
    excludedFromMetrics: false,
    onboarding: 'completed',
    onboardingActive: false,
    onboardingStepIndex: null,
    onboardingStepId: null,
    onboardingStepLabel: null,
    onboardingChapter: null,
    onboardingChapterLabel: null,
    onboardingStepKind: null,
    onboardingTotalSteps: null,
    pipeline: null,
    ...overrides,
  };
}

const dossier: UserDossier = {
  background: {
    clubTeam: 'Solar SC',
    position: 'CM',
    secondaryPosition: null,
    gradYear: 2027,
    highSchool: 'Plano West HS',
    homeCity: 'Plano',
    homeState: 'TX',
    heightIn: 69,
    weightLb: 150,
    dominantFoot: 'right',
    gpaUnweighted: 3.7,
    gpaWeighted: 4.1,
    satTotal: 1240,
    actComposite: null,
    leagueLevel: 'ECNL',
    starterStatus: 'starter',
    intendedMajors: ['Business', 'Kinesiology'],
    divisionPreference: ['D1'],
    preferredStates: ['TX', 'CA'],
    dreamSchools: 'Rice',
    recruitingStartStatus: 'emailed_a_few',
    schoolsContactedCount: 12,
    schoolsRespondedCount: 2,
    offersCount: 0,
    highlightVideoUrl: null,
  },
  stats: {
    emailsSent: 42,
    emailsOpened: 20,
    replies: 2,
    videos: 2,
    videosPublished: 1,
    coachViews: 159,
    uniqueCoachesWatched: 9,
    callsBooked: 2,
  },
  videos: [
    { id: 'v1', title: 'Maya Okafor | 2026 Fall Highlights', status: 'downloadable', createdAt: '2026-08-27T10:00:00', youtubeUrl: 'https://youtu.be/x', downloadUrl: null, coachViews: 118, uniqueCoaches: 9 },
    { id: 'v2', title: 'Maya Okafor | Skills Tape', status: 'uploading', createdAt: '2026-08-19T10:00:00', youtubeUrl: null, downloadUrl: null, coachViews: 41, uniqueCoaches: 3 },
  ],
  recentEmails: [
    { id: 'e1', coachName: 'Coach Alvarez', coachEmail: 'alvarez@rice.edu', schoolName: 'Rice University', subject: 'Maya Okafor — 2027 CM interested in Rice', sentAt: '2026-09-04T10:00:00', opened: true, openCount: 2, replied: true },
    { id: 'e2', coachName: 'Coach Whitman', coachEmail: 'whitman@smu.edu', schoolName: 'SMU', subject: 'Maya Okafor — 2027 CM interested in SMU', sentAt: '2026-09-01T10:00:00', opened: true, openCount: 1, replied: true },
    { id: 'e3', coachName: null, coachEmail: 'coach@utd.edu', schoolName: 'UT Dallas', subject: 'Hello', sentAt: '2026-09-02T10:00:00', opened: false, openCount: 0, replied: false },
  ],
  replies: [
    { id: 'e1', coachName: 'Coach Alvarez', coachEmail: 'alvarez@rice.edu', schoolName: 'Rice University', subject: 'Maya Okafor — 2027 CM interested in Rice', repliedAt: '2026-09-07T10:00:00', preview: "Thanks for reaching out, Maya. We'd love to see you at our ID camp in October." },
    { id: 'e2', coachName: 'Coach Whitman', coachEmail: 'whitman@smu.edu', schoolName: 'SMU', subject: 'Maya Okafor — 2027 CM interested in SMU', repliedAt: '2026-09-04T10:00:00', preview: null },
  ],
  topViewers: [],
  calls: [],
};

const empty: UserDossier = {
  background: null,
  stats: { emailsSent: 6, emailsOpened: 0, replies: 0, videos: 0, videosPublished: 0, coachViews: 0, uniqueCoachesWatched: 0, callsBooked: 0 },
  videos: [],
  recentEmails: [],
  replies: [],
  topViewers: [],
  calls: [],
};

test('paying athlete', () => {
  const p = buildProfile(user({}), dossier, NOW);
  assert.equal(p.planLabel, '$30 monthly');
  assert.deepEqual(p.planFact, ['$30 monthly', 'Next charge Sep 24']);
  assert.equal(p.facts, "Solar SC · CM · '27");
  assert.equal(p.checkinEligible, true);
  assert.equal(p.lastCheckin, 'never');
  assert.deepEqual(p.stats, { emails: 42, replies: 2, views: 159, calls: 2 });

  assert.equal(p.videos.length, 2);
  assert.equal(p.videos[0].status, 'Published');
  assert.equal(p.videos[0].published, true);
  assert.equal(p.videos[1].status, 'Uploading');

  assert.equal(p.replies.length, 2);
  assert.deepEqual(p.replies[0], {
    id: 'e1',
    school: 'Rice University',
    coach: 'Coach Alvarez',
    subject: 'Maya Okafor — 2027 CM interested in Rice',
    sentAt: '2026-09-04T10:00:00',
    repliedAt: '2026-09-07T10:00:00',
    snippet: "Thanks for reaching out, Maya. We'd love to see you at our ID camp in October.",
  });
  assert.equal(p.replies[1].snippet, 'Maya Okafor — 2027 CM interested in SMU', 'falls back to the subject when no reply body');

  assert.deepEqual(p.background.map(c => c.key), ['basic', 'checkin', 'academic', 'athletic', 'goals']);
  assert.deepEqual(p.background.map(c => c.label), ['Your background', "Where you're at", 'Your academics', 'Your game', 'Your goals']);
  const rows = Object.fromEntries(p.background.flatMap(c => c.rows));
  assert.equal(rows['Hometown'], 'Plano, TX');
  assert.equal(rows['Phone'], '+1 (214) 555-0142');
  assert.equal(rows['Motivation'], '—');
  assert.equal(rows['Recruiting status'], 'Emailed a few');
  assert.equal(rows['Emailed coaches'], 'Yes');
  assert.equal(rows['Coaches emailed'], '12');
  assert.equal(rows['School'], 'Plano West HS');
  assert.equal(rows['Grade next year'], '12th');
  assert.equal(rows['GPA'], '3.7');
  assert.equal(rows['SAT / ACT'], 'SAT 1240');
  assert.equal(rows['Wants to study'], 'Business · Kinesiology');
  assert.equal(rows['Height · weight'], `5'9" · 150 lb`);
  assert.equal(rows['Strongest foot'], 'Right');
  assert.equal(rows['Youth league'], 'ECNL');
  assert.equal(rows['Regions'], 'TX · CA');
  assert.equal(rows['Parent invited'], 'No');
});

test('trialing athlete with nothing yet', () => {
  const u = user({
    id: 'u2',
    name: 'Diego Ramos',
    team: 'FC Dallas Youth',
    position: 'RB',
    gradYear: 2026,
    status: 'trialing',
    paymentType: 'yearly_240_trial',
    interval: 'annual',
    paidAt: null,
    trialStartedAt: '2026-09-02T02:00:00',
    trialEndsAt: '2026-09-09T02:00:00',
  });
  const p = buildProfile(u, empty, NOW);
  assert.equal(p.planLabel, '$240 annual');
  assert.deepEqual(p.planFact, ['$240 annual · trial', 'Trial ends Sep 9 · in 14h']);
  assert.equal(p.facts, "FC Dallas Youth · RB · '26");
  assert.equal(p.checkinEligible, true);
  assert.deepEqual(p.stats, { emails: 6, replies: 0, views: 0, calls: 0 });
  assert.deepEqual(p.videos, []);
  assert.deepEqual(p.replies, []);
  const rows = Object.fromEntries(p.background.flatMap(c => c.rows));
  assert.equal(rows['Hometown'], '—');
  assert.equal(rows['Grade next year'], 'Graduated');
  assert.equal(rows['Club team'], 'FC Dallas Youth');
});

test('parent', () => {
  const u = user({
    id: 'p1',
    name: 'Karen Okafor',
    email: 'karen.okafor@gmail.com',
    phone: null,
    team: null,
    position: null,
    gradYear: null,
    status: 'signed_up',
    paymentType: null,
    interval: 'unknown',
    paidAt: null,
    trialStartedAt: null,
    trialEndsAt: null,
    isParent: true,
    onboarding: 'none',
  });
  const p = buildProfile(u, null, NOW);
  assert.equal(p.planLabel, 'Full plan');
  assert.deepEqual(p.planFact, ['No plan', 'Never started onboarding']);
  assert.equal(p.facts, '');
  assert.equal(p.checkinEligible, false);
  assert.deepEqual(p.stats, { emails: 0, replies: 0, views: 0, calls: 0 });
  const rows = Object.fromEntries(p.background.flatMap(c => c.rows));
  assert.equal(rows['Account'], 'Parent');
  assert.equal(rows['Phone'], '—');
});

test('other statuses', () => {
  assert.deepEqual(buildProfile(user({ status: 'churned', paymentType: 'canceled', interval: 'unknown' }), null, NOW).planFact, ['Full plan · cancelled', 'Cancelled']);
  assert.deepEqual(buildProfile(user({ status: 'trial_ended', paymentType: 'trial_expired', interval: 'unknown', paidAt: null, trialEndsAt: '2026-09-02T10:00:00' }), null, NOW).planFact, ['Full plan · trial', 'Trial ended 6d ago']);
  assert.deepEqual(buildProfile(user({ status: 'signed_up', paymentType: null, interval: 'unknown', paidAt: null, onboarding: 'in_progress', onboardingStepId: 'gpa' }), null, NOW).planFact, ['No plan', 'In onboarding · gpa']);
  assert.deepEqual(buildProfile(user({ status: 'signed_up', paymentType: null, interval: 'unknown', paidAt: null, onboarding: 'completed' }), null, NOW).planFact, ['No plan', 'Stopped at paywall']);
  assert.deepEqual(buildProfile(user({ status: 'paying', paymentType: 'lifetime_499', interval: 'lifetime' }), null, NOW).planFact, ['$499 lifetime', 'No renewal']);
  assert.deepEqual(buildProfile(user({ status: 'paying', paymentType: 'yearly_240_trial', interval: 'annual', paidAt: '2026-08-05T10:00:00' }), null, NOW).planFact, ['$240 annual', 'Next charge Aug 5, 2027']);
  assert.deepEqual(buildProfile(user({ status: 'paying', paymentType: 'inkbound_semester', interval: 'unknown', paidAt: '2026-09-01T10:00:00' }), null, NOW).planFact, ['Semester', 'Paid Sep 1']);
  assert.equal(planLabel('monthly_499', 'lifetime'), '$499 lifetime');
});

test('relative dates and thread', () => {
  assert.equal(formatAgo('2026-09-08T01:00:00', NOW), 'today');
  assert.equal(formatAgo('2026-09-07T23:00:00', NOW), 'yesterday');
  assert.equal(formatAgo('2026-09-05T10:00:00', NOW), '3d ago');
  const p = buildProfile(user({}), dossier, NOW);
  const thread = buildThread(p.replies[0]);
  assert.deepEqual(thread, [
    { from: 'athlete', text: 'Maya Okafor — 2027 CM interested in Rice', at: '2026-09-04T10:00:00' },
    { from: 'coach', text: "Thanks for reaching out, Maya. We'd love to see you at our ID camp in October.", at: '2026-09-07T10:00:00' },
  ]);
});
