import { createClient } from '@supabase/supabase-js';
import { createHash, createHmac } from 'node:crypto';
import { z } from 'zod';

export const EXAM_DATE = '2027-03-14';
export const REGION = 'Region V';
export const LOCATION = 'Masbate';
export const LEVELS = ['professional','subprofessional'] as const;
export const OFFICIAL_HOSTS = new Set(['csc.gov.ph','www.csc.gov.ph','services.csc.gov.ph','ro5.csc.gov.ph']);
export const settingsSchema = z.object({
  region: z.literal(REGION), testing_location: z.literal(LOCATION), professional: z.boolean(), subprofessional: z.boolean(),
  opening_alerts: z.boolean(), slot_alerts: z.boolean(), announcement_alerts: z.boolean(), closing_alerts: z.boolean()
});
export const tokenSchema = z.string().min(30).max(4096).regex(/^[A-Za-z0-9:_-]+$/);
export function db() {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase server configuration');
  return createClient(url,key,{auth:{persistSession:false}});
}
export function tokenHash(token:string) {
  const secret=process.env.TOKEN_HASH_SECRET;
  if (!secret) throw new Error('Missing TOKEN_HASH_SECRET');
  return createHmac('sha256',secret).update(token).digest('hex');
}
export function ipBucket(ip:string,route:string) {
  const secret=process.env.RATE_LIMIT_SECRET;
  if (!secret) throw new Error('Missing RATE_LIMIT_SECRET');
  return createHmac('sha256',secret).update(route+':'+ip).digest('hex');
}
export function officialUrl(value:string):boolean {
  try { const u=new URL(value); return u.protocol==='https:' && OFFICIAL_HOSTS.has(u.hostname) && !u.username && !u.password; } catch { return false; }
}
export function contentDigest(s:string) { return createHash('sha256').update(s).digest('hex'); }
