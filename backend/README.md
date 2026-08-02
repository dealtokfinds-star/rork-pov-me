# POVMe Backend

Supabase edge functions + database schema for the POVMe creator platform.

## Architecture

- **Database**: PostgreSQL (Supabase) with Row-Level Security (RLS)
- **Edge Functions**: Deno runtime on Supabase (28 functions)
- **Payments**: Lemon Squeezy (Merchant of Record) or Stripe (direct) — toggle via `PAYMENT_PROVIDER`
- **Video**: Mux (direct uploads + live streaming with signed playback)
- **Email**: Resend (transactional email for approval/rejection notices)
- **Auth**: Supabase Auth (Google/Apple OAuth, JWT verified via GoTrue)

## Setup

### 1. Environment Variables

```bash
cp .env.example .env
# Fill in your values, then set them in Supabase:
supabase secrets set SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... ...
```

Required variables (see `.env.example` for full list):

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (bypasses RLS — server only) |
| `PAYMENT_PROVIDER` | `lemonsqueezy` or `stripe` |
| `MUX_TOKEN_ID` / `MUX_TOKEN_SECRET` | Mux API credentials |
| `MUX_WEBHOOK_SECRET` | Mux webhook signing secret |
| `KYC_AUTO_APPROVE` | `true` = auto-approve creators, `false` = manual review |

### 2. Database Migrations

Migrations are in `migrations/` and should be applied in order:

```bash
# Apply all migrations
supabase db push

# Or apply individually:
supabase db execute --file migrations/001_profiles.sql
supabase db execute --file migrations/002_episodes.sql
# ... etc.

# Seed categories + admin user:
supabase db execute --file migrations/seed.sql
```

The migrations create:
- 17 tables (profiles, episodes, live_streams, subscriptions, transactions, tips, unlocks, saves, likes, chat_messages, dm_threads, dm_messages, events, reports, payouts, payout_requests, verification_docs, email_log, push_tokens, categories, audit_logs)
- 5 views (active_streams, creator_stats, creator_revenue_daily, episode_performance, platform_revenue)
- 4 RPCs (bump_stream_viewers, end_stream, bump_dm_thread, user_id)
- RLS policies on every table
- Storage buckets (avatars, covers, kyc-documents)

### 3. Webhook Endpoints

Configure these in your provider dashboards:

| Provider | URL | Purpose |
|----------|-----|---------|
| Mux | `{FUNCTIONS_URL}/mux-webhook` | Asset ready, live stream status |
| Stripe | `{FUNCTIONS_URL}/stripe-webhook` | Payment confirmed, subscription updated |
| Lemon Squeezy | `{FUNCTIONS_URL}/ls-webhook` | Order created, subscription updated |

### 4. Deploy Edge Functions

```bash
# Deploy all functions:
supabase functions deploy --no-verify-jwt

# Deploy individual functions:
supabase functions deploy stream-access
supabase functions deploy episode-access
supabase functions deploy creator-stats
```

## Edge Function Reference

### Access Gates (server-enforced)
- `stream-access` — Returns signed HLS URL if viewer has access to a live stream
- `episode-access` — Returns video URL if viewer has access to a VOD episode

### Payments
- `create-checkout` — Creates a Stripe/LemonSqueezy checkout session
- `stripe-webhook` — Handles Stripe payment confirmations
- `ls-webhook` — Handles LemonSqueezy payment confirmations
- `cancel-subscription` — Cancels a Stripe subscription (cancel_at_period_end)

### Video & Live
- `create-upload-url` — Returns a Mux direct upload URL for VOD
- `mux-webhook` — Finalizes episodes/streams when Mux processing completes
- `create-live-stream` — Provisions a Mux Live Stream
- `end-live-stream` — Ends a live stream
- `stream-health` — Returns real-time stream health metrics

### Creator
- `submit-kyc` — Submits KYC documents / verification
- `creator-payout-details` — Saves payout method (PayPal/bank)
- `creator-balance` — Returns creator balance + payout history
- `request-payout` — Creates a payout request
- `connect-account` — Stripe Connect onboarding link
- `creator-stats` — Real aggregate stats for the signed-in creator

### Engagement
- `chat-send` — Sends a chat message (enforces slow-mode + sub-only)
- `track-event` — Analytics event tracker
- `dm-send` — Sends a DM (supports paid messages)

### Admin
- `admin-actions` — Moderation actions (suspend, approve, reject, resolve report, etc.)
  - Every action is logged to the `audit_logs` table.

### Utilities
- `search` — Full-text search across creators + episodes
- `recommend` — Personalized feed recommendations
- `register-push` — Registers a push notification token
- `send-push` — Sends a push notification
- `send-email` — Sends a transactional email via Resend
- `gdpr-export` — Exports all user data (GDPR)
- `gdpr-delete` — Deletes all user data (GDPR)

## Payment Flow

```
User taps "Subscribe" / "Unlock" / "Tip" / "Top up"
  → create-checkout (creates Stripe/LS session, returns checkout URL)
  → User completes payment on provider's hosted page
  → Provider webhook fires → stripe-webhook / ls-webhook
  → Webhook inserts/updates row in transactions / subscriptions / unlocks / tips
  → Access is granted ONLY after webhook confirmation
```

The client never grants access based on local state. The `episode-access` and `stream-access` functions check the `subscriptions`, `unlocks`, and `transactions` tables server-side.

## RLS Summary

- **profiles**: Users read/update their own row; public can read creator profiles (filtered by `is_creator = true`)
- **episodes**: Creators can CRUD their own; public can read published episodes (video_url excluded for paid content without access — enforced via edge function)
- **live_streams**: Creators can CRUD their own; public reads via `active_streams` view (secrets excluded)
- **subscriptions**: Fans read their own subscriptions only
- **transactions**: Users read their own transactions only
- **chat_messages**: Authenticated users can read messages for any live stream; inserts go through the `chat-send` edge function (which enforces slow-mode + sub-only)
- **saves / likes**: Users read/write their own saves and likes
