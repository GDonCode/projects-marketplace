# Projects Marketplace — private job bidding

The owner posts a job (tied to a hotel site) → invited tradesmen bid → owner accepts one. No public sign-up, no payments, no open marketplace — just the closed, private loop.

## Stack
- Next.js 14 (App Router, Server Actions)
- Supabase (Postgres + Auth + Row Level Security)
- Tailwind CSS

## Setup

1. **Create a Supabase project** at supabase.com.
2. **Run the schema.** Open the SQL editor in your Supabase project and run everything in `supabase/schema.sql`. This creates the tables and the RLS policies that keep each tradesman scoped to only the jobs they're invited to — enforced at the database level, not just hidden in the UI.
3. **Env vars.** Copy `.env.local.example` to `.env.local` and fill in your project URL and anon key (Project Settings → API in Supabase).
4. **Install and run:**
   ```bash
   npm install
   npm run dev
   ```
5. **Create your first users.** There's no public sign-up by design. In Supabase:
   - Authentication → Users → Add user, for the owner and for each tradesman contact.
   - In the `tradesmen` table, add a row per tradesman/trade crew — name, trade (electrical, plumbing, masonry, etc.), contact info.
   - In the `profiles` table, add a row per user: `role = 'client'` for the owner, `role = 'company'` + the matching `tradesman_id` for each tradesman contact.

## How it works

- **Owner** signs in → lands on `/dashboard` → posts a job (title, hotel/site, description, budget, timeline) and checks off which invited tradesmen should see it → reviews bids on the job page → accepts one, which locks the job and rejects the rest.
- **Tradesman** signs in → lands on `/portal` → sees only jobs they were invited to → submits (or updates) one bid per job.
- Jobs carry a `site` field (e.g. "Round Hill Hotel") so it's clear which property the work is for at a glance.

## Extending later
- Email notification on new job / new bid (Resend + a Supabase Edge Function or DB webhook)
- Per-job invite management from the job detail page (currently set at creation only)
- Filter tradesmen by trade when picking invitees, once the roster grows
