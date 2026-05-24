# Convex setup

The app now uses Convex as its database + real-time backend. Code is in `convex/`.
Follow these steps once, in order.

## 1. Create the Convex project

```bash
nvm use 20            # Node 20+ required
npx convex dev        # interactive — first run will:
                      #   - prompt you to log in / sign up
                      #   - ask for a project name (suggest: gappartment)
                      #   - write CONVEX_DEPLOYMENT + NEXT_PUBLIC_CONVEX_URL
                      #     into .env.local automatically
                      #   - generate types under convex/_generated/
                      #   - keep watching for function changes
```

Leave `npx convex dev` running while you work. In a separate terminal start the
Next.js app with `npm run dev`.

## 2. Wire Clerk → Convex auth

Convex authenticates requests using a Clerk JWT.

### a. Create the JWT template in Clerk
1. Clerk dashboard → **JWT Templates** → **New template**.
2. Pick the **Convex** template if listed, otherwise name it manually `convex`.
3. Save. Copy the **Issuer** URL (looks like
   `https://<subdomain>.clerk.accounts.dev`).

### b. Tell Convex who to trust
```bash
npx convex env set CLERK_JWT_ISSUER_DOMAIN https://<subdomain>.clerk.accounts.dev
```

Re-run `npx convex dev` if it was running — it will pick up the new env var and
push `auth.config.ts`.

## 3. Production deploy to Netlify

You want every Netlify build to:
1. Push the latest `convex/` functions + schema to your **production** Convex
   deployment, then
2. Run `next build` with `NEXT_PUBLIC_CONVEX_URL` already pointing at prod.

The `convex deploy --cmd '<build cmd>'` wrapper does both atomically — if the
Convex deploy fails, the Next.js build is aborted, so you never ship a
frontend wired to a stale backend.

### a. Generate a production deploy key (one-time)
1. Convex dashboard → your project → **Settings** → **Deploy Keys**.
2. Click **Generate Production Deploy Key** and copy it.

### b. Configure Netlify
**Site settings → Build & deploy → Build command:**
```
npx convex deploy --cmd 'npm run build'
```

**Site settings → Environment variables — add these:**

| Key                                       | Value                                              |
|-------------------------------------------|----------------------------------------------------|
| `CONVEX_DEPLOY_KEY`                       | the prod deploy key from step (a)                  |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`       | your Clerk publishable key                         |
| `CLERK_SECRET_KEY`                        | your Clerk secret key                              |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL`           | `/sign-in`                                         |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL`           | `/sign-up`                                         |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL`     | `/`                                                |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL`     | `/setup-profile`                                   |
| `CLERK_WEBHOOK_SECRET`                    | from Clerk → Webhooks (only if you wired one)      |
| `UPLOADTHING_TOKEN`                       | from UploadThing                                   |

> Do **not** set `NEXT_PUBLIC_CONVEX_URL` manually on Netlify. The
> `convex deploy --cmd` wrapper injects it during the build, pointing at the
> deployment that `CONVEX_DEPLOY_KEY` belongs to. The
> `NEXT_PUBLIC_CONVEX_URL` value in your local `.env.local` is for the dev
> deployment only.

### c. Tell the production Convex deployment about Clerk
```bash
npx convex env set CLERK_JWT_ISSUER_DOMAIN https://<subdomain>.clerk.accounts.dev --prod
```

(Same value as the dev deployment — the JWT issuer doesn't change.)

## 4. First admin user

The first signed-in user (whose Clerk identity gets synced into Convex) is
automatically marked admin. That happens in `convex/users.ts:sync` — checks
if the `users` table is empty.

If you already have an account and need to promote it later, open the Convex
dashboard for your deployment → `users` table → edit the row → set `isAdmin: true`.

## 5. Running locally

Two terminals:

```bash
# terminal 1
npx convex dev

# terminal 2
npm run dev
```

Open http://localhost:3839 and sign in. The dashboard's `UserSync` component
mirrors your Clerk identity into Convex on first render.

## 6. Web Push notifications (optional but supported)

Notifications fire when:
- A new bill is added → every tenant in the bill (except the admin who added it)
- A new shared expense is added → every tenant except the adder
- A payment proof is submitted (single or bulk) → the receiver

### a. Generate VAPID keys (one-time)
```bash
npx web-push generate-vapid-keys --json
```
Output looks like `{"publicKey":"...","privateKey":"..."}`. Keep both — you'll need them in two places.

### b. Configure Convex (server-side)
```bash
npx convex env set VAPID_PUBLIC_KEY  "<publicKey from step a>"
npx convex env set VAPID_PRIVATE_KEY "<privateKey from step a>"
npx convex env set VAPID_SUBJECT     "mailto:you@example.com"
```
For production, run each command with `--prod`.

### c. Configure the Next.js app (client-side)
Add to `.env.local` (and to Netlify env vars):
```
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<the same publicKey from step a>
```

### d. Try it
Run the app, open **Profile → Notifications**, click **Enable notifications**, grant the browser prompt. Add a bill from another browser/account → a system notification appears.

If VAPID env vars are missing on Convex the `sendToUsers` action becomes a silent no-op, so the rest of the app still works.

### Notes
- iOS Safari only delivers push notifications to **installed PWAs** (Add to Home Screen).
- The service worker lives at `public/sw.js`; the lifecycle helpers are in `lib/push.ts`.
- Expired subscriptions (404/410 from the push service) are auto-pruned by the action.
