# CSE Registration Alert

Independent, mobile-friendly monitor for the March 14, 2027 CSE-PPT in Region V, Masbate. The dashboard reports only observed official evidence. This project is not affiliated with CSC.

## Project structure

```text
api/                    Vercel server-only status, subscription, test endpoints
src/ui/                 React dashboard and FCM browser client
src/server/             Official-source checker, verification rules, FCM sender
supabase/migrations/    PostgreSQL schema, indexes, RLS, rate-limit function
public/                 PWA manifest, icon, combined cache/push service worker
.github/workflows/      Hourly monitoring job
```

## Status semantics

Gray means no verified target evidence. Blue means an official page mentions the target exam. Orange means registration wording exists but a live Masbate application slot cannot be independently verified. Green requires confirmed active applications and a matching available slot. An additional appointment card reports the signed-in CSC eServe calendar for Region 5, Masbate FO, Career Service - Professional. A selectable date sends a `slots` push alert to subscribed devices. No CAPTCHA or access control is bypassed, and an inaccessible calendar is reported as a failed check rather than an opening. Generic closure text is likewise not treated as per-level slot closure.

The checker visits the CSC homepage and services homepage, reads robots.txt first, waits between requests, and records errors. It does not guess an opening date. Region V announcement discovery is limited to official content visible on those pages; a direct Region V feed can be added after its exact official URL and robots policy are verified.

## Local setup

1. Install Node.js 22 and run `npm install`.
2. Create a Supabase free project. In its SQL Editor, run `supabase/migrations/001_initial.sql`. Keep the service-role key secret. RLS is enabled on every table and anonymous clients have no policies. The frontend accesses data only through `/api/status`.
3. Create a Firebase project, add a Web app, enable Cloud Messaging, create a Web Push VAPID key, and create a service account. Put its project ID, client email, and private key in server variables. The public Firebase web config and VAPID key use `VITE_` variables.
4. Copy `.env.example` to `.env.local` and fill in every variable. Generate independent random values for `TOKEN_HASH_SECRET` and `RATE_LIMIT_SECRET` (for example with a password manager). For a multiline private key, use literal `\n` escapes.
5. Run `npm run build` and `npm test`. For local API testing use `npx vercel dev`; Vite's `npm run dev` alone serves only the frontend. Set `PUBLIC_BASE_URL` to the local or deployed origin.
6. Run `npm run check` to perform a manual checker pass after the database migration. Review `monitoring_logs` and `registration_status` in Supabase.

## Deployment

1. Push this repository to GitHub. Keep `.env.local` out of Git.
2. Add GitHub Actions secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, and `TOKEN_HASH_SECRET`. For signed-in CSC appointment checks, also add `CSC_EMAIL` and `CSC_PASSWORD` as Actions secrets. Set a fresh CSC password directly in GitHub; never commit it or send it in chat. Add repository variable `PUBLIC_BASE_URL` with the final HTTPS site origin.
3. Connect the repository to Vercel Hobby. Configure every `.env.example` variable in Vercel Project Settings → Environment Variables, except `PUBLIC_BASE_URL` should be the deployed HTTPS origin. Build command: `npm run build`; output: `dist`.
4. In GitHub Actions, run **Check official CSC sources** manually. Inspect its logs, then confirm new `monitoring_logs` entries in Supabase. The appointment step installs Playwright Chromium, signs in to CSC eServe, selects Region 5 / Masbate FO / Career Service - Professional, and checks its calendar through March 2027. It skips when the CSC secrets are missing and fails if CSC requires CAPTCHA or blocks the session. The schedule runs at minute 17 each hour, subject to GitHub scheduling delays or dropped runs; it is not an exact-minute guarantee. Keep the repository active and check workflow history periodically.
5. On Android Chrome, open the HTTPS site, tap **Enable notifications**, allow permission, and use **Send test notification**. Confirm foreground and background delivery. Install via Chrome menu → **Add to Home screen** / **Install app**. Test offline: the app shell and last cached status should load with a stale warning. On iPhone, use a supported Home Screen web app; browser push support varies by OS and browser.

## Security and operational notes

- Service-role and Firebase Admin credentials stay in Vercel functions and GitHub Actions. FCM device tokens are stored only in a private RLS table. API requests are validated and limited with an atomic Supabase rate-limit function. Disable deletes the token record. The device token acts as the credential for its own settings; protect it like a secret.
- Notification events are claimed by unique `(subscription_id,event_key)` rows before sending, preventing duplicate alerts across overlapping checks. A process failure between claim and delivery can leave a pending row; inspect `notification_history` for such cases.
- The dashboard caches the last successful API response. A stale banner appears after two hours or a failed refresh. The next check shown is an estimate based on the latest log.
- Supabase free projects may pause after inactivity and have storage/compute quotas. GitHub Actions free usage and Vercel Hobby function limits apply. FCM Web Push requires HTTPS (localhost is allowed for development), browser support, and explicit permission. Check the providers' current plan pages before relying on the service.
- The single service worker handles offline shell caching and FCM data push. Server sends data messages; the worker shows one notification, avoiding automatic display duplicates.

## Tests and verification

`npm test` covers the central false-positive gate with mocked official page text and structured calendar inputs. Before relying on appointment alerts, verify the authenticated workflow with a manual run and confirm Android notification delivery with the site's test button. Live CSC sign-in, CAPTCHA behavior, and phone delivery require the user's account and device and are not simulated by unit tests.
