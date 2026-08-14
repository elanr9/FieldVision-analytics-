import { createClient } from '@supabase/supabase-js';

function adminClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  bodyHtml: string;
  isDefault: boolean;
  updatedAt: string;
}

interface TemplateRow {
  id: string;
  name: string | null;
  subject: string | null;
  body_html: string | null;
  is_default: boolean | null;
  updated_at: string;
}

const TEMPLATE_ORDER = [
  'Initial Outreach',
  'Initial Outreach #2',
  'Transfer Outreach',
  'Follow-Up #1',
  'Follow-Up #2',
];

function mapRow(row: TemplateRow): EmailTemplate {
  return {
    id: row.id,
    name: row.name ?? 'Untitled',
    subject: row.subject ?? '',
    bodyHtml: row.body_html ?? '',
    isDefault: Boolean(row.is_default),
    updatedAt: row.updated_at,
  };
}

function sortTemplates(templates: EmailTemplate[]): EmailTemplate[] {
  return [...templates].sort((a, b) => {
    const ai = TEMPLATE_ORDER.indexOf(a.name);
    const bi = TEMPLATE_ORDER.indexOf(b.name);
    if (ai === -1 && bi === -1) return a.name.localeCompare(b.name);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}

export async function loadEmailTemplates(userId: string): Promise<EmailTemplate[]> {
  const { data, error } = await adminClient()
    .from('email_templates')
    .select('id, name, subject, body_html, is_default, updated_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return sortTemplates((data ?? []).map(row => mapRow(row as TemplateRow)));
}

export async function updateEmailTemplate(input: {
  id: string;
  name?: string;
  subject?: string;
  bodyHtml?: string;
}): Promise<EmailTemplate> {
  const patch: Record<string, string> = { updated_at: new Date().toISOString() };
  if (input.name !== undefined) patch.name = input.name;
  if (input.subject !== undefined) patch.subject = input.subject;
  if (input.bodyHtml !== undefined) patch.body_html = input.bodyHtml;

  const { data, error } = await adminClient()
    .from('email_templates')
    .update(patch)
    .eq('id', input.id)
    .select('id, name, subject, body_html, is_default, updated_at')
    .single();
  if (error) throw error;
  return mapRow(data as TemplateRow);
}
