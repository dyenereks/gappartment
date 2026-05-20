@AGENTS.md

# GAppartment — Bill Sharing App

## Tech Stack
- **Next.js 16** (App Router) with **Tailwind CSS v4**
- **Clerk** for authentication (Google OAuth)
- **Prisma 5** with **SQLite** (`prisma/dev.db`)
- **UploadThing** for file uploads (QR codes, payment proofs)

## Dev Setup
```bash
# Requires Node.js 20+ (use nvm: nvm use 20)
npm install
npm run dev
```

## Environment Variables
Copy `.env.local.example` to `.env.local` and fill in:
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` + `CLERK_SECRET_KEY` from [Clerk dashboard](https://dashboard.clerk.com)
- `UPLOADTHING_SECRET` + `UPLOADTHING_APP_ID` from [UploadThing](https://uploadthing.com)
- `CLERK_WEBHOOK_SECRET` (optional, for production user sync)

## Database
```bash
npx prisma migrate dev  # Run migrations
npx prisma studio       # Browse database
```

## Key Design Decisions
- **First registered user becomes admin** (checked in layout + webhook)
- **Tailwind v4** uses CSS-based config in `globals.css` (no `tailwind.config.ts`)
- **Color palette**: cream (`cream-100`), dark brown (`brown-600`), dark gray (`charcoal-500`)
- **proxy.ts** replaces `middleware.ts` (Next.js 16 convention)
- Clerk users are synced to DB on dashboard layout render (handles missing webhook)

## App Structure
```
app/(auth)/         — sign-in, sign-up
app/(dashboard)/    — all protected pages (layout syncs user)
  page.tsx          — dashboard overview
  bills/            — monthly bills (admin can add)
  expenses/         — shared expenses (any tenant can add)
  payments/         — pay & confirm (tabbed: outgoing / incoming)
  profile/          — upload QR code
  admin/            — admin panel (tenant balances, bill overview)
app/api/            — REST API routes
components/         — shared components (modals, Navbar, etc.)
lib/                — prisma client, utils, uploadthing helpers
prisma/             — schema.prisma + dev.db
```

## Bill Types
Predefined: `RENT`, `ELECTRIC`, `WATER` (in `lib/utils.ts`)

## Payment Flow
1. Bill/expense added → shares created
2. Tenant uploads proof via PaymentModal → `proofUrl` saved, `paidAt` set
3. Receiver reviews proof → ConfirmPaymentModal → `isPaid = true`, `confirmedAt` set
4. Receiver can reject → clears `proofUrl` and `paidAt`
