// TODO(handoff-3): wire real usage data
// Hard-coded copy of the mock's seeded `usage` and `platform` (design_handoffs/01_shell_overview/mock/data.js.txt).

export interface UsageFeature {
  id: string;
  label: string;
  /** Lucide glyph path data on a 24-unit viewBox */
  icon: string;
  events30: number;
  users30: number;
}

export const SAMPLE_USAGE: UsageFeature[] = [
  { id: 'highlights', label: 'Highlight maker', icon: 'M2 8.5A2.5 2.5 0 0 1 4.5 6h9A2.5 2.5 0 0 1 16 8.5v7a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 2 15.5zM16 10l5-3v10l-5-3', events30: 1720, users30: 61 },
  { id: 'campaign', label: 'Coach emails', icon: 'M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM3 7l9 6 9-6', events30: 1362, users30: 46 },
  { id: 'schools', label: 'School search', icon: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-5-5', events30: 1270, users30: 45 },
  { id: 'inbox', label: 'Coach replies', icon: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z', events30: 861, users30: 28 },
  { id: 'roadmap', label: 'Roadmap', icon: 'M9 4v16M15 4v16M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z', events30: 500, users30: 20 },
  { id: 'profile', label: 'Athlete profile', icon: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z', events30: 430, users30: 18 },
  { id: 'calls', label: 'Book a call', icon: 'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.8 2z', events30: 169, users30: 7 },
  { id: 'parent', label: 'Parent view', icon: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8', events30: 112, users30: 9 },
];

export const SAMPLE_PLATFORM = {
  conversations: 214,
  videos: 138,
  videosPublished: 121,
  emailsSent: 3420,
  emailsOpened: 1910,
  replies: 412,
  calls: 31,
  campaigns: 296,
  schoolsSaved: 2140,
};
