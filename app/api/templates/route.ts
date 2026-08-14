import { NextResponse, type NextRequest } from 'next/server';
import { loadEmailTemplates, updateEmailTemplate } from '@/lib/email-templates';

export const dynamic = 'force-dynamic';

/** Protected by the password middleware. Returns this athlete's coach email templates. */
export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId');
  if (!userId) {
    return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
  }
  try {
    const templates = await loadEmailTemplates(userId);
    return NextResponse.json({ templates });
  } catch (err) {
    console.error('Template load failed', err);
    return NextResponse.json({ error: 'Failed to load templates' }, { status: 500 });
  }
}

/** Protected by the password middleware. Saves edits to one template. */
export async function PATCH(request: Request) {
  const body = (await request.json()) as {
    id?: string;
    name?: string;
    subject?: string;
    bodyHtml?: string;
  };
  if (!body.id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }
  if (body.name === undefined && body.subject === undefined && body.bodyHtml === undefined) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }
  try {
    const template = await updateEmailTemplate({
      id: body.id,
      name: body.name,
      subject: body.subject,
      bodyHtml: body.bodyHtml,
    });
    return NextResponse.json({ template });
  } catch (err) {
    console.error('Template update failed', err);
    return NextResponse.json({ error: 'Failed to save template' }, { status: 500 });
  }
}
