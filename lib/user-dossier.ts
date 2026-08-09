import { createClient } from '@supabase/supabase-js';

function adminClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

export interface DossierBackground {
  clubTeam: string | null;
  position: string | null;
  secondaryPosition: string | null;
  gradYear: number | null;
  highSchool: string | null;
  homeCity: string | null;
  homeState: string | null;
  heightIn: number | null;
  weightLb: number | null;
  dominantFoot: string | null;
  gpaUnweighted: number | null;
  gpaWeighted: number | null;
  satTotal: number | null;
  actComposite: number | null;
  leagueLevel: string | null;
  starterStatus: string | null;
  intendedMajors: string[];
  divisionPreference: string[];
  preferredStates: string[];
  dreamSchools: string | null;
  recruitingStartStatus: string | null;
  schoolsContactedCount: number | null;
  schoolsRespondedCount: number | null;
  offersCount: number | null;
  highlightVideoUrl: string | null;
}

export interface DossierVideo {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  youtubeUrl: string | null;
  downloadUrl: string | null;
  coachViews: number;
  uniqueCoaches: number;
}

export interface DossierEmail {
  id: string;
  coachName: string | null;
  coachEmail: string | null;
  schoolName: string | null;
  subject: string | null;
  sentAt: string | null;
  opened: boolean;
  openCount: number;
  replied: boolean;
}

export interface DossierReply {
  id: string;
  coachName: string | null;
  coachEmail: string | null;
  schoolName: string | null;
  subject: string | null;
  repliedAt: string;
  preview: string | null;
}

export interface DossierViewer {
  coachEmail: string;
  schoolName: string | null;
  openCount: number;
  lastOpenedAt: string | null;
  maxWatchPct: number | null;
}

export interface DossierCall {
  id: string;
  ambassadorName: string | null;
  startAt: string | null;
  endAt: string | null;
  status: string;
  meetLink: string | null;
  note: string | null;
}

export interface UserDossier {
  background: DossierBackground | null;
  stats: {
    emailsSent: number;
    emailsOpened: number;
    replies: number;
    videos: number;
    videosPublished: number;
    coachViews: number;
    uniqueCoachesWatched: number;
    callsBooked: number;
  };
  videos: DossierVideo[];
  recentEmails: DossierEmail[];
  replies: DossierReply[];
  topViewers: DossierViewer[];
  calls: DossierCall[];
}

interface IntakeRow {
  club_team: string | null;
  position: string | null;
  secondary_position: string | null;
  grad_year: number | null;
  high_school: string | null;
  home_city: string | null;
  home_state: string | null;
  height_in: number | null;
  weight_lb: number | null;
  dominant_foot: string | null;
  gpa_unweighted: number | null;
  gpa_weighted: number | null;
  sat_total: number | null;
  act_composite: number | null;
  league_level: string | null;
  starter_status: string | null;
  intended_majors: string[] | null;
  division_preference: string[] | null;
  preferred_states: string[] | null;
  dream_schools: string | null;
  recruiting_start_status: string | null;
  schools_contacted_count: number | null;
  schools_responded_count: number | null;
  offers_count: number | null;
  highlight_video_url: string | null;
}

interface ProjectRow {
  id: string;
  title: string | null;
  name: string | null;
  status: string | null;
  created_at: string;
  youtube_url: string | null;
  download_url: string | null;
}

interface EmailRow {
  id: string;
  coach_name: string | null;
  coach_email: string | null;
  school_id: string | null;
  subject: string | null;
  sent_at: string | null;
  created_at: string;
  opened_at: string | null;
  open_count: number | null;
  replied_at: string | null;
  reply_body: string | null;
}

interface ViewRow {
  coach_email: string | null;
  school_id: string | null;
  project_id: string | null;
  open_count: number | null;
  last_opened_at: string | null;
  max_watch_pct: number | null;
}

interface BookingRow {
  id: string;
  ambassador_name: string | null;
  start_at: string | null;
  end_at: string | null;
  status: string | null;
  meet_link: string | null;
  student_note: string | null;
}

function heightLabel(inches: number | null): string | null {
  if (!inches) return null;
  const ft = Math.floor(inches / 12);
  const rem = inches % 12;
  return `${ft}'${rem}"`;
}

export function formatHeight(inches: number | null): string | null {
  return heightLabel(inches);
}

/** Loads the founder-facing dossier for one athlete from FieldVision tables. */
export async function loadUserDossier(userId: string): Promise<UserDossier> {
  const supabase = adminClient();

  const emailSelect =
    'id, coach_name, coach_email, school_id, subject, sent_at, created_at, opened_at, open_count, replied_at, reply_body';

  const [
    intakeRes,
    projectsRes,
    recentEmailsRes,
    replyEmailsRes,
    emailsSentCountRes,
    emailsOpenedCountRes,
    repliesCountRes,
    viewsRes,
    bookingsRes,
  ] = await Promise.all([
    supabase
      .from('user_onboarding_intake')
      .select(
        'club_team, position, secondary_position, grad_year, high_school, home_city, home_state, height_in, weight_lb, dominant_foot, gpa_unweighted, gpa_weighted, sat_total, act_composite, league_level, starter_status, intended_majors, division_preference, preferred_states, dream_schools, recruiting_start_status, schools_contacted_count, schools_responded_count, offers_count, highlight_video_url',
      )
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('projects')
      .select('id, title, name, status, created_at, youtube_url, download_url')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    supabase
      .from('user_sent_emails')
      .select(emailSelect)
      .eq('user_id', userId)
      .eq('status', 'sent')
      .order('sent_at', { ascending: false })
      .limit(12),
    supabase
      .from('user_sent_emails')
      .select(emailSelect)
      .eq('user_id', userId)
      .eq('status', 'sent')
      .not('replied_at', 'is', null)
      .order('replied_at', { ascending: false })
      .limit(10),
    supabase
      .from('user_sent_emails')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'sent'),
    supabase
      .from('user_sent_emails')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'sent')
      .not('opened_at', 'is', null),
    supabase
      .from('user_sent_emails')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'sent')
      .not('replied_at', 'is', null),
    supabase
      .from('video_views')
      .select('coach_email, school_id, project_id, open_count, last_opened_at, max_watch_pct')
      .eq('user_id', userId)
      .limit(2000),
    supabase
      .from('ambassador_bookings')
      .select('id, ambassador_name, start_at, end_at, status, meet_link, student_note')
      .eq('student_user_id', userId)
      .order('start_at', { ascending: false }),
  ]);

  const intake = (intakeRes.data ?? null) as IntakeRow | null;
  const projects = (projectsRes.data ?? []) as ProjectRow[];
  const emails = (recentEmailsRes.data ?? []) as EmailRow[];
  const replyEmails = (replyEmailsRes.data ?? []) as EmailRow[];
  const views = (viewsRes.data ?? []) as ViewRow[];
  const bookings = (bookingsRes.data ?? []) as BookingRow[];
  const emailsSentCount = emailsSentCountRes.count ?? emails.length;
  const emailsOpenedCount = emailsOpenedCountRes.count ?? 0;
  const repliesCount = repliesCountRes.count ?? replyEmails.length;

  const schoolIds = Array.from(
    new Set(
      [
        ...emails.map(e => e.school_id),
        ...replyEmails.map(e => e.school_id),
        ...views.map(v => v.school_id),
      ].filter((id): id is string => Boolean(id)),
    ),
  );

  const schoolNameById = new Map<string, string>();
  if (schoolIds.length > 0) {
    const { data: schools } = await supabase
      .from('schools')
      .select('school_id, name')
      .in('school_id', schoolIds.slice(0, 200));
    for (const row of schools ?? []) {
      const id = row.school_id as string;
      const name = row.name as string | null;
      if (id && name) schoolNameById.set(id, name);
    }
  }

  const viewsByProject = new Map<string, { opens: number; coaches: Set<string> }>();
  const viewerMap = new Map<
    string,
    { schoolId: string | null; openCount: number; lastOpenedAt: string | null; maxWatchPct: number | null }
  >();

  for (const view of views) {
    if (view.project_id) {
      const bucket = viewsByProject.get(view.project_id) ?? { opens: 0, coaches: new Set<string>() };
      bucket.opens += view.open_count ?? 1;
      if (view.coach_email) bucket.coaches.add(view.coach_email.toLowerCase());
      viewsByProject.set(view.project_id, bucket);
    }
    if (view.coach_email) {
      const key = view.coach_email.toLowerCase();
      const existing = viewerMap.get(key);
      const openCount = (existing?.openCount ?? 0) + (view.open_count ?? 1);
      const lastOpenedAt =
        !existing?.lastOpenedAt ||
        (view.last_opened_at &&
          new Date(view.last_opened_at).getTime() > new Date(existing.lastOpenedAt).getTime())
          ? view.last_opened_at
          : existing.lastOpenedAt;
      const maxWatchPct = Math.max(existing?.maxWatchPct ?? 0, Number(view.max_watch_pct ?? 0));
      viewerMap.set(key, {
        schoolId: view.school_id ?? existing?.schoolId ?? null,
        openCount,
        lastOpenedAt: lastOpenedAt ?? null,
        maxWatchPct: maxWatchPct || null,
      });
    }
  }

  const videos: DossierVideo[] = projects.map(p => {
    const stats = viewsByProject.get(p.id);
    return {
      id: p.id,
      title: p.title || p.name || 'Highlight video',
      status: p.status ?? 'unknown',
      createdAt: p.created_at,
      youtubeUrl: p.youtube_url,
      downloadUrl: p.download_url,
      coachViews: stats?.opens ?? 0,
      uniqueCoaches: stats?.coaches.size ?? 0,
    };
  });

  const recentEmails: DossierEmail[] = emails.map(e => ({
    id: e.id,
    coachName: e.coach_name,
    coachEmail: e.coach_email,
    schoolName: e.school_id ? schoolNameById.get(e.school_id) ?? null : null,
    subject: e.subject,
    sentAt: e.sent_at ?? e.created_at,
    opened: Boolean(e.opened_at),
    openCount: e.open_count ?? (e.opened_at ? 1 : 0),
    replied: Boolean(e.replied_at),
  }));

  const replies: DossierReply[] = replyEmails.map(e => ({
    id: e.id,
    coachName: e.coach_name,
    coachEmail: e.coach_email,
    schoolName: e.school_id ? schoolNameById.get(e.school_id) ?? null : null,
    subject: e.subject,
    repliedAt: e.replied_at!,
    preview: e.reply_body
      ? e.reply_body.replace(/\s+/g, ' ').trim().slice(0, 160)
      : null,
  }));

  const topViewers: DossierViewer[] = Array.from(viewerMap.entries())
    .map(([coachEmail, info]) => ({
      coachEmail,
      schoolName: info.schoolId ? schoolNameById.get(info.schoolId) ?? null : null,
      openCount: info.openCount,
      lastOpenedAt: info.lastOpenedAt,
      maxWatchPct: info.maxWatchPct,
    }))
    .sort((a, b) => b.openCount - a.openCount)
    .slice(0, 12);

  const calls: DossierCall[] = bookings.map(b => ({
    id: b.id,
    ambassadorName: b.ambassador_name,
    startAt: b.start_at,
    endAt: b.end_at,
    status: b.status ?? 'unknown',
    meetLink: b.meet_link,
    note: b.student_note,
  }));

  const background: DossierBackground | null = intake
    ? {
        clubTeam: intake.club_team,
        position: intake.position,
        secondaryPosition: intake.secondary_position,
        gradYear: intake.grad_year,
        highSchool: intake.high_school,
        homeCity: intake.home_city,
        homeState: intake.home_state,
        heightIn: intake.height_in,
        weightLb: intake.weight_lb,
        dominantFoot: intake.dominant_foot,
        gpaUnweighted: intake.gpa_unweighted,
        gpaWeighted: intake.gpa_weighted,
        satTotal: intake.sat_total,
        actComposite: intake.act_composite,
        leagueLevel: intake.league_level,
        starterStatus: intake.starter_status,
        intendedMajors: intake.intended_majors ?? [],
        divisionPreference: intake.division_preference ?? [],
        preferredStates: intake.preferred_states ?? [],
        dreamSchools: intake.dream_schools,
        recruitingStartStatus: intake.recruiting_start_status,
        schoolsContactedCount: intake.schools_contacted_count,
        schoolsRespondedCount: intake.schools_responded_count,
        offersCount: intake.offers_count,
        highlightVideoUrl: intake.highlight_video_url,
      }
    : null;

  return {
    background,
    stats: {
      emailsSent: emailsSentCount,
      emailsOpened: emailsOpenedCount,
      replies: repliesCount,
      videos: projects.length,
      videosPublished: projects.filter(p => p.youtube_url).length,
      coachViews: views.reduce((sum, v) => sum + (v.open_count ?? 1), 0),
      uniqueCoachesWatched: viewerMap.size,
      callsBooked: bookings.length,
    },
    videos,
    recentEmails,
    replies,
    topViewers,
    calls,
  };
}
