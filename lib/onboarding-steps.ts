export type OnboardingChapter = 'basic' | 'checkin' | 'academic' | 'athletic' | 'goals';

export type ShowWhenRule =
  | { field: keyof OnboardingVisibilityFields; equals: string; notParent?: boolean }
  | { education: 'high_school' | 'college' }
  | { notCollegeAndNotHsOnly: true }
  | { notParent: true; field?: keyof OnboardingVisibilityFields; equals?: string };

/** Intake fields needed to resolve visible redesign steps. */
export interface OnboardingVisibilityFields {
  education_level: string | null;
  has_emailed_coaches: string | null;
  league_level: string | null;
  pro_aspiration: string | null;
  parent_invite_choice: string | null;
}

export interface OnboardingStepDef {
  id: string;
  chapter: OnboardingChapter;
  kind: string;
  question: string | null;
  parentQuestion: string | null;
  lead: string | null;
  variant: string | null;
  showWhen?: ShowWhenRule;
}

export const CHAPTER_LABELS: Record<OnboardingChapter, string> = {
  basic: "Your background",
  checkin: "Where you're at",
  academic: "Your academics",
  athletic: "Your game",
  goals: "Your goals",
};

/** Mirror of fieldvisionai REDESIGN_STEPS for analytics labeling. Keep in sync. */
export const ONBOARDING_STEPS: OnboardingStepDef[] = [
  { id: "survey_intro", chapter: "basic", kind: "interstitial", question: "Survey intro", parentQuestion: null, lead: null, variant: "survey-intro" },
  { id: "name", chapter: "basic", kind: "name", question: "What's your name?", parentQuestion: null, lead: "Let's get to know each other.", variant: null },
  { id: "account_type", chapter: "basic", kind: "account-type", question: "Are you the athlete or the parent?", parentQuestion: null, lead: null, variant: null },
  { id: "gender", chapter: "basic", kind: "gender", question: "Men's or women's soccer?", parentQuestion: "Does your athlete play men's or women's soccer?", lead: null, variant: null },
  { id: "hi_name", chapter: "basic", kind: "interstitial", question: "Hi name", parentQuestion: null, lead: null, variant: "hi-name" },
  { id: "motivation", chapter: "basic", kind: "select", question: "What brings you to FieldVision?", parentQuestion: "What brings your athlete to FieldVision?", lead: null, variant: null },
  { id: "why_college_soccer", chapter: "basic", kind: "multi-select", question: "Why do you want to play college soccer?", parentQuestion: "Why does your athlete want to play college soccer?", lead: null, variant: null },
  { id: "used_other_services", chapter: "basic", kind: "select", question: "Have you used any other recruiting software or services?", parentQuestion: "Has your athlete used any other recruiting software or services?", lead: null, variant: null },
  { id: "heard_about_us", chapter: "basic", kind: "select", question: "Where did you hear about FieldVision?", parentQuestion: null, lead: null, variant: null },
  { id: "phone_number", chapter: "basic", kind: "phone", question: "What's your phone number?", parentQuestion: "What's your phone number?", lead: null, variant: null },
  { id: "birthday", chapter: "basic", kind: "date", question: "When's your birthday?", parentQuestion: "When's your athlete's birthday?", lead: null, variant: null },
  { id: "hometown", chapter: "basic", kind: "hometown", question: "Where do you call home?", parentQuestion: "Where does your athlete call home?", lead: null, variant: null },
  { id: "saving", chapter: "checkin", kind: "interstitial", question: "Saving your background", parentQuestion: null, lead: null, variant: "saving" },
  { id: "checkin_intro", chapter: "checkin", kind: "interstitial", question: "Check-in intro", parentQuestion: null, lead: null, variant: "checkin-intro" },
  { id: "recruiting_start_status", chapter: "checkin", kind: "select", question: "Where are you in the recruiting process right now?", parentQuestion: "Where is your athlete in the recruiting process right now?", lead: null, variant: null },
  { id: "recruiting_clarity", chapter: "checkin", kind: "select", question: "Do you feel like you know what to do next?", parentQuestion: "Do you feel like you know what your athlete should do next?", lead: null, variant: null },
  { id: "has_emailed_coaches", chapter: "checkin", kind: "select", question: "Have you emailed any coaches yet?", parentQuestion: "Has your athlete emailed any coaches yet?", lead: null, variant: null },
  { id: "schools_contacted_count", chapter: "checkin", kind: "select", question: "How many coaches have you emailed so far?", parentQuestion: "How many coaches has your athlete emailed so far?", lead: null, variant: null, showWhen: {"field":"has_emailed_coaches","equals":"Yes"} },
  { id: "outreach_challenge", chapter: "checkin", kind: "select", question: "What slows you down the most with emails?", parentQuestion: "What slows your athlete down the most with emails?", lead: null, variant: null, showWhen: {"field":"has_emailed_coaches","equals":"No"} },
  { id: "highlight_videos_count", chapter: "checkin", kind: "select", question: "How many highlight videos do you have?", parentQuestion: "How many highlight videos does your athlete have?", lead: null, variant: null },
  { id: "highlight_challenge", chapter: "checkin", kind: "select", question: "What slows you down the most with highlight videos?", parentQuestion: "What slows your athlete down the most with highlight videos?", lead: null, variant: null },
  { id: "highlight_time_belief", chapter: "checkin", kind: "select", question: "How long do you think it takes to make one highlight video?", parentQuestion: "How long do you think it takes to make one highlight video?", lead: null, variant: null },
  { id: "video_payoff", chapter: "checkin", kind: "interstitial", question: "Video payoff", parentQuestion: null, lead: null, variant: "video-payoff" },
  { id: "weekly_time_available", chapter: "checkin", kind: "select", question: "How much time do you have each week for recruiting?", parentQuestion: "How much time does your athlete have each week for recruiting?", lead: null, variant: null },
  { id: "time_agitate", chapter: "checkin", kind: "interstitial", question: "Time agitate", parentQuestion: null, lead: null, variant: "time-agitate" },
  { id: "recruiting_stress_level", chapter: "checkin", kind: "select", question: "How do you feel with college recruitment right now?", parentQuestion: "How does your athlete feel about college recruitment right now?", lead: null, variant: null },
  { id: "projection_checkin", chapter: "checkin", kind: "projection", question: "Commitment projection", parentQuestion: null, lead: null, variant: null },
  { id: "academics_intro", chapter: "academic", kind: "interstitial", question: "Academics intro", parentQuestion: null, lead: null, variant: "academics-intro" },
  { id: "education_level", chapter: "academic", kind: "select", question: "Where are you right now?", parentQuestion: "Where is your athlete right now?", lead: null, variant: null },
  { id: "high_school_name", chapter: "academic", kind: "text", question: "What high school do you attend?", parentQuestion: "What high school does your child attend?", lead: null, variant: null, showWhen: {"education":"high_school"} },
  { id: "college_name", chapter: "academic", kind: "college-search", question: "What college do you attend?", parentQuestion: "What college does your child attend?", lead: null, variant: null, showWhen: {"education":"college"} },
  { id: "recruiting_intent", chapter: "academic", kind: "select", question: "How many years of eligibility do you have left?", parentQuestion: "How many years of eligibility does your athlete have left?", lead: null, variant: null, showWhen: {"education":"college"} },
  { id: "college_stats", chapter: "academic", kind: "college-stats", question: "Let's find your college stats", parentQuestion: "Let's find your child's college stats", lead: null, variant: null, showWhen: {"education":"college"} },
  { id: "grade_level", chapter: "academic", kind: "select", question: "What grade will you be in next school year?", parentQuestion: "What grade will your athlete be in next school year?", lead: null, variant: null, showWhen: {"education":"high_school"} },
  { id: "gpa", chapter: "academic", kind: "gpa", question: "What's your GPA?", parentQuestion: "What's your athlete's GPA?", lead: null, variant: null },
  { id: "test_scores", chapter: "academic", kind: "test-scores", question: "Have you taken the SAT or ACT?", parentQuestion: null, lead: null, variant: null },
  { id: "major", chapter: "academic", kind: "major", question: "What do you want to study?", parentQuestion: "What does your athlete want to study?", lead: null, variant: null },
  { id: "projection_academics", chapter: "academic", kind: "projection", question: "Commitment projection", parentQuestion: null, lead: null, variant: null },
  { id: "game_intro", chapter: "athletic", kind: "interstitial", question: "Game intro", parentQuestion: null, lead: null, variant: "game-intro" },
  { id: "height_weight", chapter: "athletic", kind: "height-weight", question: "Height and weight", parentQuestion: null, lead: null, variant: null },
  { id: "dominant_foot", chapter: "athletic", kind: "select", question: "What's your strongest foot?", parentQuestion: "What's your athlete's strongest foot?", lead: null, variant: null },
  { id: "position", chapter: "athletic", kind: "position", question: "What position do you play?", parentQuestion: "What position does your athlete play?", lead: null, variant: null },
  { id: "youth_league", chapter: "athletic", kind: "youth-league", question: "What youth league do you play in?", parentQuestion: "What youth league does your athlete play in?", lead: null, variant: null },
  { id: "club_team", chapter: "athletic", kind: "text", question: "What club team do you play for?", parentQuestion: "What club team does your athlete play for?", lead: null, variant: null, showWhen: {"notCollegeAndNotHsOnly":true} },
  { id: "projection_game", chapter: "athletic", kind: "projection", question: "Commitment projection", parentQuestion: null, lead: null, variant: null },
  { id: "auth_gate", chapter: "goals", kind: "auth-gate", question: "Sign in gate", parentQuestion: null, lead: null, variant: null },
  { id: "almost_done", chapter: "goals", kind: "interstitial", question: "Almost done", parentQuestion: null, lead: null, variant: "almost-done" },
  { id: "goals_intro", chapter: "goals", kind: "interstitial", question: "Goals intro", parentQuestion: null, lead: null, variant: "goals-intro" },
  { id: "region", chapter: "goals", kind: "region", question: "Which parts of the country sound good?", parentQuestion: "Which parts of the country sound good for your athlete?", lead: null, variant: null },
  { id: "top_schools", chapter: "goals", kind: "top-schools", question: "Great choices! Here's some of your region's top programs.", parentQuestion: "Great choices! Here's some of your athlete's region's top programs.", lead: null, variant: null },
  { id: "school_size_preference", chapter: "goals", kind: "select", question: "What size school feels like you?", parentQuestion: "What size school feels right for your athlete?", lead: null, variant: null },
  { id: "setting_preference", chapter: "goals", kind: "select", question: "What kind of setting do you want?", parentQuestion: "What kind of setting does your athlete want?", lead: null, variant: null },
  { id: "priorities", chapter: "goals", kind: "priority", question: "Out of everything you told us, what matters most? Rank your top 3.", parentQuestion: "Out of everything you told us, what matters most for your athlete? Rank the top 3.", lead: null, variant: null },
  { id: "pro_aspiration", chapter: "goals", kind: "select", question: "Are you trying to go pro after college?", parentQuestion: "Is your athlete trying to go pro after college?", lead: null, variant: null },
  { id: "naia_juco_path_interest", chapter: "goals", kind: "select", question: "Are you open to the Community College path?", parentQuestion: "Is your athlete open to the Community College path?", lead: null, variant: null, showWhen: {"field":"pro_aspiration","equals":"Yes, going pro is the goal"} },
  { id: "parent_invite_optin", chapter: "goals", kind: "select", question: "Would you like to invite a parent to see your college recruitment journey?", parentQuestion: null, lead: null, variant: null, showWhen: {"notParent":true} },
  { id: "parent_invite_email", chapter: "goals", kind: "parent-invite-email", question: "What's Mom or Dad's email?", parentQuestion: null, lead: null, variant: null, showWhen: {"notParent":true,"field":"parent_invite_choice","equals":"Yes"} },
];

export const ONBOARDING_STEP_BY_ID = new Map(ONBOARDING_STEPS.map(s => [s.id, s]));
