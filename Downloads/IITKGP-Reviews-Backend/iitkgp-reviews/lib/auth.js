import { createHash, randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query } from './db.js';
import { ApiError, body, json } from './http.js';

const sessionSeconds = 12 * 60 * 60;

function appOrigin() {
  const configured = new URL(process.env.APP_ORIGIN);
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(configured.hostname);
  if (configured.origin !== process.env.APP_ORIGIN ||
      (configured.protocol !== 'https:' && !(loopback && configured.protocol === 'http:'))) {
    throw new Error('APP_ORIGIN must be an HTTPS origin or a local HTTP origin');
  }
  return configured;
}

export function requireSameOrigin(request) {
  if (request.headers.get('origin') !== appOrigin().origin) {
    throw new ApiError(403, 'Request origin is not allowed.');
  }
}

function sessionCookie() {
  const secure = appOrigin().protocol === 'https:';
  return {
    name: secure ? '__Host-iitkgp_session' : 'iitkgp_local_session',
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure,
  };
}

function sessionHash(request) {
  const value = request.cookies.get(sessionCookie().name)?.value;
  if (!value || !/^[a-f0-9]{64}$/.test(value)) return null;
  return hash(value);
}

function hash(value) {
  return createHash('sha256').update(value).digest();
}

function withSessionCookie(data, value, maxAge) {
  const response = NextResponse.json(data, { headers: { 'Cache-Control': 'private, no-store' } });
  response.cookies.set({ ...sessionCookie(), value, maxAge });
  return response;
}

function authClient() {
  const { SUPABASE_URL, SUPABASE_PUBLIC_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_PUBLIC_KEY) throw new Error('Supabase configuration is required');
  return createClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  }).auth;
}

async function eligible(email) {
  const { rows } = await query('select review_app.student_eligible($1) as allowed', [email]);
  return rows[0].allowed;
}

export async function requireStudent(request) {
  const digest = sessionHash(request);
  if (!digest) throw new ApiError(401, 'Sign in to continue.');
  const { rows } = await query('select review_app.session_student($1) as student_id', [digest]);
  if (!rows[0].student_id) throw new ApiError(401, 'Sign in to continue.');
  return rows[0].student_id;
}

const email = z.string().trim().toLowerCase().pipe(z.email().max(254));
const emailInput = z.strictObject({ email });
const verifyInput = z.strictObject({ email, code: z.string().regex(/^\d{6}$/) });

export async function startSignIn(request) {
  const input = await body(request, emailInput);
  // Keep the HTTP response the same whether an address is eligible or not.
  if (await eligible(input.email)) await authClient().signInWithOtp({ email: input.email });
  return json({ accepted: true });
}

export async function verifySignIn(request) {
  const { email: address, code } = await body(request, verifyInput);
  const invalid = () => new ApiError(401, 'Sign-in code expired or invalid.');
  if (!(await eligible(address))) throw invalid();

  const { data, error } = await authClient().verifyOtp({ email: address, token: code, type: 'email' });
  if (error?.status === 429) throw new ApiError(429, 'Wait before trying again.');
  if (error?.status >= 500) throw new ApiError(503, 'Sign-in service unavailable.');
  if (error || !data.session || !data.user?.email_confirmed_at ||
      data.user.email?.toLowerCase() !== address) throw invalid();

  const token = randomBytes(32).toString('hex');
  const { rows } = await query('select review_app.issue_session($1, $2, $3) as issued',
    [data.user.id, hash(token), sessionHash(request)]);
  if (!rows[0].issued) throw invalid();
  return withSessionCookie({ authenticated: true, expiresIn: sessionSeconds }, token, sessionSeconds);
}

export async function signOut(request) {
  const digest = sessionHash(request);
  if (digest) await query('select review_app.revoke_session($1)', [digest]);
  return withSessionCookie({ authenticated: false }, '', 0);
}
