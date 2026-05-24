@AGENTS.md

# GAppartment — Bill Sharing App

## Tech Stack
- **Next.js 16** (App Router) with **Tailwind CSS v4**
- **Clerk** for authentication (Google OAuth)
- **Convex** for the database and real-time queries/mutations
- **UploadThing** for file uploads (QR codes, payment proofs)

## Dev Setup
```bash
# Requires Node.js 20+ (use nvm: nvm use 20)
npm install
npx convex dev      # Run in one terminal — keeps functions in sync
npm run dev         # Run in another terminal — Next.js app
```

## Environment Variables
Copy `.env.local.example` to `.env.local` and fill in:
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` + `CLERK_SECRET_KEY` from [Clerk dashboard](https://dashboard.clerk.com)
- `UPLOADTHING_TOKEN` from [UploadThing](https://uploadthing.com)
- `CLERK_WEBHOOK_SECRET` (optional, for production user sync)
- `NEXT_PUBLIC_CONVEX_URL` is written automatically by `npx convex dev`

## Convex auth (Clerk JWT)
1. In Clerk dashboard → JWT Templates → create one named `convex`
   (issuer becomes `https://<your-subdomain>.clerk.accounts.dev`)
2. Set the issuer URL on your Convex deployment:
   `npx convex env set CLERK_JWT_ISSUER_DOMAIN https://<your-subdomain>.clerk.accounts.dev`

## Key Design Decisions
- **First registered user becomes admin** (in `convex/users.ts:sync`)
- **Tailwind v4** uses CSS-based config in `globals.css` (no `tailwind.config.ts`)
- **Color palette**: cream (`cream-100`), dark brown (`brown-600`), dark gray (`charcoal-500`)
- **proxy.ts** replaces `middleware.ts` (Next.js 16 convention)
- **Clerk users are mirrored to Convex** via `UserSync` (client component) on first
  dashboard render; the Clerk webhook also calls `users.syncFromWebhook` as a backup.
- Pages use real-time Convex hooks (`useQuery`, `useMutation`) — no fetch / API
  routes for data. The only API routes left are `/api/webhooks/clerk` and
  `/api/uploadthing`.

## App Structure
```
app/(auth)/         — sign-in, sign-up
app/(dashboard)/    — all protected pages
  page.tsx          — dashboard overview
  bills/            — monthly bills (admin can add)
  expenses/         — shared expenses (any tenant can add)
  payments/         — pay & confirm (tabbed: outgoing / incoming)
  profile/          — upload QR code, set nickname
  admin/            — admin panel (tenant balances, bill overview)
app/setup-profile/  — post-signup nickname prompt
app/api/            — only webhook + uploadthing routes
components/         — shared components (modals, Navbar, providers, etc.)
convex/             — Convex schema and functions (queries/mutations)
lib/                — utils, uploadthing helpers
```

## Bill Types
Predefined: `RENT`, `ELECTRIC`, `WATER` (in `lib/utils.ts`)

## Payment Flow
1. Bill/expense added → shares created
2. Tenant uploads proof via PaymentModal → `proofUrl` saved, `paidAt` set
3. Receiver reviews proof → ConfirmPaymentModal → `isPaid = true`, `confirmedAt` set
4. Receiver can reject → clears `proofUrl` and `paidAt`
