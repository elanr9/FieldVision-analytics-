import { createClient } from '@supabase/supabase-js';
import { createPrivateKey, sign } from 'node:crypto';
import { connect } from 'node:http2';

const PRODUCTION_HOST = 'https://api.push.apple.com';
const SANDBOX_HOST = 'https://api.sandbox.push.apple.com';

function adminClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

/** Short lived ES256 JWT for APNs auth, signed with the .p8 key. */
function apnsJwt(): string {
  const teamId = process.env.APNS_TEAM_ID;
  const keyId = process.env.APNS_KEY_ID;
  const privateKeyPem = process.env.APNS_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!teamId || !keyId || !privateKeyPem) {
    throw new Error('APNS_TEAM_ID, APNS_KEY_ID, and APNS_PRIVATE_KEY must be set');
  }
  const header = base64url(JSON.stringify({ alg: 'ES256', kid: keyId }));
  const payload = base64url(
    JSON.stringify({ iss: teamId, iat: Math.floor(Date.now() / 1000) }),
  );
  const signingInput = `${header}.${payload}`;
  const key = createPrivateKey(privateKeyPem);
  const signature = sign('sha256', Buffer.from(signingInput), {
    key,
    dsaEncoding: 'ieee-p1363',
  });
  return `${signingInput}.${base64url(signature)}`;
}

interface ApnsResponse {
  status: number;
  reason: string | null;
}

/** One APNs HTTP/2 request to a single host for a single device token. */
function sendToHost(
  host: string,
  deviceToken: string,
  jwt: string,
  body: string,
): Promise<ApnsResponse> {
  return new Promise((resolve, reject) => {
    const session = connect(host);
    session.on('error', reject);
    const request = session.request({
      ':method': 'POST',
      ':path': `/3/device/${deviceToken}`,
      authorization: `bearer ${jwt}`,
      'apns-topic': process.env.APNS_TOPIC ?? 'ai.fieldvision.analytics',
      'apns-push-type': 'alert',
      'apns-priority': '10',
      'content-type': 'application/json',
    });
    let status = 0;
    request.on('response', headers => {
      status = Number(headers[':status'] ?? 0);
    });
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('end', () => {
      session.close();
      const text = Buffer.concat(chunks).toString();
      let reason: string | null = null;
      if (text) {
        try {
          reason = (JSON.parse(text) as { reason?: string }).reason ?? null;
        } catch {
          reason = text;
        }
      }
      resolve({ status, reason });
    });
    request.on('error', reject);
    request.end(body);
  });
}

export type PushData = Record<string, string>;

/**
 * Sends an alert push to every registered device.
 * Tries production APNs first and falls back to sandbox for tokens issued
 * by development builds. Tokens Apple reports as dead are deleted.
 * Extra string fields in `data` are delivered to the client for deep links.
 */
export async function sendPushToAll(
  title: string,
  body: string,
  data: PushData = {},
): Promise<void> {
  const supabase = adminClient();
  const { data: rows, error } = await supabase
    .from('analytics_push_tokens')
    .select('token');
  if (error) throw error;

  const tokens = (rows ?? []).map(row => row.token as string);
  if (tokens.length === 0) return;

  const jwt = apnsJwt();
  const payload = JSON.stringify({
    aps: { alert: { title, body }, sound: 'default' },
    ...data,
  });
  const deadTokens: string[] = [];

  for (const token of tokens) {
    try {
      let result = await sendToHost(PRODUCTION_HOST, token, jwt, payload);
      if (result.reason === 'BadDeviceToken') {
        result = await sendToHost(SANDBOX_HOST, token, jwt, payload);
      }
      if (result.status === 410 || result.reason === 'BadDeviceToken' || result.reason === 'Unregistered') {
        deadTokens.push(token);
      }
    } catch (err) {
      console.error(`APNs send failed for token ${token.slice(0, 8)}…`, err);
    }
  }

  if (deadTokens.length > 0) {
    await supabase.from('analytics_push_tokens').delete().in('token', deadTokens);
  }
}
