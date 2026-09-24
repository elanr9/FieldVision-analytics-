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
  sport: string | null;
  motivation: string | null;
  whyCollegeSoccer: string | null;
  usedOtherServices: string | null;
  heardAboutUs: string | null;
  birthday: string | null;
  recruitingClarity: string | null;
  hasEmailedCoaches: string | null;
  outreachChallenge: string | null;
  highlightVideosCount: number | null;
  highlightChallenge: string | null;
  weeklyTimeAvailable: string | null;
  recruitingStressLevel: string | null;
  educationLevel: string | null;
  collegeName: string | null;
  schoolSizePreference: string | null;
  settingPreference: string | null;
  priorityRankings: string[];
  proAspiration: string | null;
  naiaJucoPathInterest: string | null;
  parentInviteChoice: string | null;
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
  sentAt: string | null;
  repliedAt: string;
  /** First 160 chars of the coach's reply, for list rows */
  preview: string | null;
  /** The athlete's outreach email as plain text */
  outreachBody: string | null;
  /** The coach's full reply as plain text */
  replyBody: string | null;
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

export interface DossierCampaignSchool {
  key: string;
  schoolId: string | null;
  schoolName: string | null;
  coachName: string | null;
  coachEmail: string | null;
  /** First outreach email in this campaign to this school */
  sentAt: string | null;
  /** Initial email plus follow-ups sent to this school inside this campaign */
  emails: number;
  opened: boolean;
  openCount: number;
  replied: boolean;
  repliedAt: string | null;
  /** Highest watch percentage any coach at this school reached on the athlete's videos */
  videoWatchPct: number | null;
}

export interface DossierCampaign {
  id: string;
  name: string;
  status: string;
  purpose: string | null;
  createdAt: string;
  sentAt: string | null;
  schools: DossierCampaignSchool[];
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
  campaigns: DossierCampaign[];
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
  sport: string | null;
  motivation: string | null;
  why_college_soccer: string | null;
  used_other_services: string | null;
  heard_about_us: string | null;
  birthday: string | null;
  recruiting_clarity: string | null;
  has_emailed_coaches: string | null;
  outreach_challenge: string | null;
  highlight_videos_count: number | null;
  highlight_challenge: string | null;
  weekly_time_available: string | null;
  recruiting_stress_level: string | null;
  education_level: string | null;
  college_name: string | null;
  school_size_preference: string | null;
  setting_preference: string | null;
  priority_rankings: string[] | null;
  pro_aspiration: string | null;
  naia_juco_path_interest: string | null;
  parent_invite_choice: string | null;
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
  body_html?: string | null;
}

interface CampaignEmailRow {
  id: string;
  list_id: string | null;
  school_id: string | null;
  coach_name: string | null;
  coach_email: string | null;
  sent_at: string | null;
  created_at: string;
  opened_at: string | null;
  open_count: number | null;
  replied_at: string | null;
}

interface ListRow {
  id: string;
  name: string | null;
  status: string | null;
  purpose: string | null;
  created_at: string;
  sent_at: string | null;
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

/** Turns a stored email HTML body into readable plain text with paragraph breaks. */
function htmlToText(html: string | null): string | null {
  if (!html) return null;
  const text = html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return text || null;
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
    listsRes,
    campaignEmailsRes,
  ] = await Promise.all([
    supabase
      .from('user_onboarding_intake')
      .select(
        'club_team, position, secondary_position, grad_year, high_school, home_city, home_state, height_in, weight_lb, dominant_foot, gpa_unweighted, gpa_weighted, sat_total, act_composite, league_level, starter_status, intended_majors, division_preference, preferred_states, dream_schools, recruiting_start_status, schools_contacted_count, schools_responded_count, offers_count, highlight_video_url, sport, motivation, why_college_soccer, used_other_services, heard_about_us, birthday, recruiting_clarity, has_emailed_coaches, outreach_challenge, highlight_videos_count, highlight_challenge, weekly_time_available, recruiting_stress_level, education_level, college_name, school_size_preference, setting_preference, priority_rankings, pro_aspiration, naia_juco_path_interest, parent_invite_choice',
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
      .select(`${emailSelect}, body_html`)
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
    supabase
      .from('outreach_lists')
      .select('id, name, status, purpose, created_at, sent_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    supabase
      .from('user_sent_emails')
      .select('id, list_id, school_id, coach_name, coach_email, sent_at, created_at, opened_at, open_count, replied_at')
      .eq('user_id', userId)
      .eq('status', 'sent')
      .order('sent_at', { ascending: true })
      .limit(3000),
  ]);

  const intake = (intakeRes.data ?? null) as IntakeRow | null;
  const lists = (listsRes.data ?? []) as ListRow[];
  const campaignEmails = (campaignEmailsRes.data ?? []) as CampaignEmailRow[];
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
        ...campaignEmails.map(e => e.school_id),
      ].filter((id): id is string => Boolean(id)),
    ),
  );

  const schoolNameById = new Map<string, string>();
  for (let i = 0; i < schoolIds.length; i += 200) {
    const { data: schools } = await supabase
      .from('schools')
      .select('school_id, name')
      .in('school_id', schoolIds.slice(i, i + 200));
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
    sentAt: e.sent_at ?? e.created_at,
    repliedAt: e.replied_at!,
    preview: e.reply_body
      ? e.reply_body.replace(/\s+/g, ' ').trim().slice(0, 160)
      : null,
    outreachBody: htmlToText(e.body_html ?? null),
    replyBody: e.reply_body?.trim() || null,
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

  const campaigns = buildCampaigns(lists, campaignEmails, views, schoolNameById);

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
        sport: intake.sport,
        motivation: intake.motivation,
        whyCollegeSoccer: intake.why_college_soccer,
        usedOtherServices: intake.used_other_services,
        heardAboutUs: intake.heard_about_us,
        birthday: intake.birthday,
        recruitingClarity: intake.recruiting_clarity,
        hasEmailedCoaches: intake.has_emailed_coaches,
        outreachChallenge: intake.outreach_challenge,
        highlightVideosCount: intake.highlight_videos_count,
        highlightChallenge: intake.highlight_challenge,
        weeklyTimeAvailable: intake.weekly_time_available,
        recruitingStressLevel: intake.recruiting_stress_level,
        educationLevel: intake.education_level,
        collegeName: intake.college_name,
        schoolSizePreference: intake.school_size_preference,
        settingPreference: intake.setting_preference,
        priorityRankings: intake.priority_rankings ?? [],
        proAspiration: intake.pro_aspiration,
        naiaJucoPathInterest: intake.naia_juco_path_interest,
        parentInviteChoice: intake.parent_invite_choice,
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
    campaigns,
  };
}

const UNLISTED_CAMPAIGN_ID = 'unlisted';

/**
 * One row per school per campaign. Follow-ups to the same school inside a
 * campaign are folded into that school's row. Emails sent outside any list
 * are grouped into a single "Sent outside a campaign" bucket.
 */
function buildCampaigns(
  lists: ListRow[],
  emails: CampaignEmailRow[],
  views: ViewRow[],
  schoolNameById: Map<string, string>,
): DossierCampaign[] {
  const watchBySchool = new Map<string, number>();
  const watchByCoach = new Map<string, number>();
  for (const view of views) {
    const pct = Number(view.max_watch_pct ?? 0);
    if (view.school_id) watchBySchool.set(view.school_id, Math.max(watchBySchool.get(view.school_id) ?? 0, pct));
    if (view.coach_email) {
      const key = view.coach_email.toLowerCase();
      watchByCoach.set(key, Math.max(watchByCoach.get(key) ?? 0, pct));
    }
  }

  const schoolsByList = new Map<string, Map<string, DossierCampaignSchool>>();
  for (const e of emails) {
    const listId = e.list_id ?? UNLISTED_CAMPAIGN_ID;
    const schoolKey = e.school_id ?? e.coach_email?.toLowerCase() ?? e.id;
    const bucket = schoolsByList.get(listId) ?? new Map<string, DossierCampaignSchool>();
    const existing = bucket.get(schoolKey);
    const sentAt = e.sent_at ?? e.created_at;
    const coachKey = e.coach_email?.toLowerCase();
    const watchPct = Math.max(
      e.school_id ? watchBySchool.get(e.school_id) ?? 0 : 0,
      coachKey ? watchByCoach.get(coachKey) ?? 0 : 0,
    );
    bucket.set(schoolKey, {
      key: `${listId}:${schoolKey}`,
      schoolId: e.school_id,
      schoolName: e.school_id ? schoolNameById.get(e.school_id) ?? null : null,
      coachName: existing?.coachName ?? e.coach_name,
      coachEmail: existing?.coachEmail ?? e.coach_email,
      sentAt: existing?.sentAt ?? sentAt,
      emails: (existing?.emails ?? 0) + 1,
      opened: Boolean(existing?.opened || e.opened_at),
      openCount: (existing?.openCount ?? 0) + (e.open_count ?? (e.opened_at ? 1 : 0)),
      replied: Boolean(existing?.replied || e.replied_at),
      repliedAt: existing?.repliedAt ?? e.replied_at,
      videoWatchPct: watchPct > 0 ? watchPct : null,
    });
    schoolsByList.set(listId, bucket);
  }

  const campaigns: DossierCampaign[] = lists.map(l => ({
    id: l.id,
    name: l.name ?? 'Campaign',
    status: l.status ?? 'unknown',
    purpose: l.purpose,
    createdAt: l.created_at,
    sentAt: l.sent_at,
    schools: Array.from(schoolsByList.get(l.id)?.values() ?? []),
  }));

  const unlisted = schoolsByList.get(UNLISTED_CAMPAIGN_ID);
  if (unlisted && unlisted.size > 0) {
    const schools = Array.from(unlisted.values());
    const firstSent = schools.map(s => s.sentAt).filter((d): d is string => Boolean(d)).sort()[0] ?? null;
    campaigns.push({
      id: UNLISTED_CAMPAIGN_ID,
      name: 'Sent outside a campaign',
      status: 'sent',
      purpose: null,
      createdAt: firstSent ?? new Date(0).toISOString(),
      sentAt: firstSent,
      schools,
    });
  }

  return campaigns;
}
