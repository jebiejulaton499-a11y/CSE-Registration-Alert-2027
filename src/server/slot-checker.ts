import { chromium, type Page, type Response } from 'playwright';
import { db, EXAM_DATE, LOCATION, REGION } from './shared.js';
import { sendEvent } from './notify.js';

const SOURCE = 'https://services.csc.gov.ph/client/services';
const LEVEL = 'professional';

type CalendarEvent = { start?: unknown; percent?: unknown };

/** Match the CSC calendar's own rule: a date is selectable when its mean occupancy is below 100%. */
export function availableDates(rows: unknown, today: string, examDate = EXAM_DATE): string[] {
  if (!Array.isArray(rows)) throw new Error('CSC calendar returned invalid event data');
  const byDate = new Map<string, number[]>();
  for (const row of rows as CalendarEvent[]) {
    const date = typeof row.start === 'string' ? row.start.slice(0, 10) : '';
    const percent = Number(row.percent);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || row.percent == null || !Number.isFinite(percent) || percent < 0 || percent > 100)
      throw new Error('CSC calendar event is missing a valid date or occupancy');
    if (date < today || date >= examDate) continue;
    byDate.set(date, [...(byDate.get(date) ?? []), percent]);
  }
  return [...byDate].filter(([, values]) => values.reduce((a, b) => a + b, 0) / values.length < 100)
    .map(([date]) => date).sort();
}

async function select2(page: Page, id: string, label: string) {
  await page.locator(`#select2-${id}-container`).click();
  await page.locator('.select2-results__option').filter({ hasText: label }).click();
  if (await page.locator(`#select2-${id}-container`).getAttribute('title') !== label)
    throw new Error(`CSC did not select ${label}`);
}

function isCalendarResponse(response: Response) {
  try {
    const url = new URL(response.url());
    return url.pathname === '/client/getEvents' && url.searchParams.get('loc_id') === '191' && url.searchParams.get('form_id') === '206';
  } catch { return false; }
}

async function checkSignedInCalendar(email: string, password: string): Promise<string[]> {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ locale: 'en-PH', timezoneId: 'Asia/Manila' });
    const page = await context.newPage();
    await page.goto(SOURCE, { waitUntil: 'domcontentloaded', timeout: 30000 });
    if (!page.url().startsWith(SOURCE)) {
      if (await page.locator('iframe[src*="captcha"], .g-recaptcha, [data-sitekey]').count())
        throw new Error('CSC requested CAPTCHA; manual sign-in required');
      await page.locator('input[type="email"], input[name="email"]').first().fill(email);
      await page.locator('input[type="password"]').first().fill(password);
      await page.getByRole('button', { name: 'Login', exact: true }).click();
      if (await page.locator('iframe[src*="captcha"], .g-recaptcha, [data-sitekey]').count())
        throw new Error('CSC requested CAPTCHA; manual sign-in required');
      await page.waitForURL(/\/client\//, { timeout: 20000 }).catch(() => {
        throw new Error('CSC sign-in did not complete; check account access manually');
      });
      if (!page.url().startsWith(SOURCE)) await page.goto(SOURCE, { waitUntil: 'domcontentloaded' });
    }
    if (!page.url().startsWith(SOURCE)) throw new Error('CSC appointment calendar is unavailable');

    await select2(page, 'region', 'REGION 5');
    await select2(page, 'location', 'Masbate FO');
    const firstEvents = page.waitForResponse(isCalendarResponse, { timeout: 20000 });
    await select2(page, 'form', 'Career Service - Professional');
    let response = await firstEvents;
    const locationId = await page.locator('#location').inputValue();
    const formId = await page.locator('#form').inputValue();
    if (locationId !== '191' || formId !== '206') throw new Error('CSC selected an unexpected office or exam');
    const notice = page.locator('#swal2-title');
    if (await notice.isVisible().catch(() => false)) {
      const title = await notice.innerText();
      if (!/Mar\s+14,?\s+2027.*Professional/i.test(title)) throw new Error('CSC exam notice does not match the target exam');
      await page.locator('.swal2-confirm').click();
    }

    const dates = new Set<string>();
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
    const part = (name: string) => parts.find(p => p.type === name)?.value ?? '';
    const today = `${part('year')}-${part('month')}-${part('day')}`;
    for (let month = 0; month < 7; month++) {
      if (!response.ok()) throw new Error(`CSC calendar returned HTTP ${response.status()}`);
      const requestUrl = new URL(response.url());
      if (requestUrl.searchParams.get('loc_id') !== locationId || requestUrl.searchParams.get('form_id') !== formId)
        throw new Error('CSC calendar response did not match Masbate Professional');
      for (const date of availableDates(await response.json(), today)) dates.add(date);
      const heading = await page.locator('#calendar .fc-left h2').innerText();
      if (heading === 'March 2027') break;
      if (month === 6 || !(await page.locator('#calendar .fc-next-button').isEnabled()))
        throw new Error('CSC calendar could not reach the exam month');
      const nextEvents = page.waitForResponse(isCalendarResponse, { timeout: 20000 });
      await page.locator('#calendar .fc-next-button').click();
      response = await nextEvents;
    }
    return [...dates].sort();
  } finally { await browser.close(); }
}

export async function runSlotCheck() {
  const email = process.env.CSC_EMAIL, password = process.env.CSC_PASSWORD;
  if (!email || !password) {
    console.log('CSC credentials are not configured; appointment check skipped');
    return;
  }
  const client = db();
  const { data: previous, error: previousError } = await client.from('monitoring_logs')
    .select('detected_status,verification_result').eq('source_url', SOURCE).order('checked_at', { ascending: false }).limit(1).maybeSingle();
  if (previousError) throw previousError;
  try {
    const dates = await checkSignedInCalendar(email, password);
    const result = dates.length ? `Available appointment dates: ${dates.join(', ')}` : 'No selectable Masbate Professional dates observed';
    const previousDates = new Set((previous?.detected_status === 'open' ? previous.verification_result : '').match(/\d{4}-\d{2}-\d{2}/g) ?? []);
    for (const date of dates.filter(d => !previousDates.has(d))) {
      await sendEvent({ key: `slot:${EXAM_DATE}:${LEVEL}:${date}:${Date.now()}`, type: 'slots', level: LEVEL,
        title: 'MASBATE REGISTRATION SLOTS AVAILABLE!',
        message: `CSC eServe shows a selectable Masbate FO Professional appointment date: ${date}. Open CSC eServe and book promptly.`,
        sourceUrl: SOURCE });
    }
    const { error } = await client.from('monitoring_logs').insert({ source_url: SOURCE, detected_status: dates.length ? 'open' : 'not_verified', verification_result: result });
    if (error) throw error;
    console.log(result);
  } catch (error) {
    await client.from('monitoring_logs').insert({ source_url: SOURCE, detected_status: 'verification_failed', verification_result: 'CSC appointment check failed', error_message: String(error).slice(0, 500) });
    throw error;
  }
}

if (process.argv[1]?.endsWith('slot-checker.ts')) runSlotCheck().catch(error => { console.error(error instanceof Error ? error.message.split('\n')[0] : String(error)); process.exitCode = 1; });
