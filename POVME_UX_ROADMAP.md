# POVMe — Full UX, Motion & Monetization Redesign

Audit of the app as it ships today (Expo client), with prioritized changes,
before/after descriptions, and a motion spec for every major action.

North-star principles:

- **Money in the moment** — payments never navigate away from the emotion.
- **Three taps to value** — cold open → watching content in ≤ 3 taps.
- **One thumb** — every primary action lives in the thumb zone.
- **Motion is information** — animation explains state change; 150–300 ms, never decoration-only.
- **Creator confidence** — every revenue event is visible to the creator instantly.

---

## Priority 1 — MUST-HAVE (next 2 weeks)

### M1. Kill the navigation-based money flow → in-context bottom sheets

**Before:** Tipping in a live stream pushes `/tip/[id]` (a full screen with 4 sections:
presets, custom input, note, gifts). Subscribing pushes `/subscribe/[id]`. Unlocking a
PPV pushes `/unlock/[id]`. After paying you navigate *back* to the stream, then wait
for the gate to re-check. That's 3–4 taps + a full-screen detour between wanting to
pay and paying. Every detour loses tips.

**After:** Three bottom sheets that mount **over** the live room and episode player:

- **Tip sheet** — 4 preset chips ($2/$5/$10/$25), custom amount, optional note
  (collapsed behind a "Add note" link), gift rail. One big "Send $X" button.
  Pay → sheet springs away → coin/gift animates into the stream → message appears
  in chat with the amount. Total: 2 taps.
- **Subscribe sheet** — creator avatar + price + what you get (3 bullet chips), one
  button. On success: button morphs into "Subscribed" state, no navigation.
- **Unlock sheet** — price, "watch instantly" promise, one button. On success the
  gate dissolves in place and playback starts without a single frame of nav.

- **One-tap pay (save card on first checkout):** first payment sets up the card via
  Stripe PaymentIntents; subsequent payments are one tap — no checkout redirect.
  Keep Apple/Google Pay as the default when available.

- Tip/subscribe/unlock sheets share one `PaymentSheet` component so behavior and
  animation stay identical everywhere.

### M2. Onboarding: 5 screens → 3

**Before:** 3 brand slides → intent (viewer/creator) → name/handle → taste picker →
follow creators → ready. Five decisions before value; the follow step makes you
manually pick creators from a long list you have no basis to judge.

**After:** **Slides (2) → intent → taste → ready.** Name prefills from OAuth
profile. The follow step becomes *auto-suggested follows* — from your taste picks
the ready screen shows "We'll start you with these 6 creators" as removable chips
with one Continue button. Users who want to curate can tap them away; everyone
else moves on. Onboarding finishes in ~40 seconds.

Motion: existing slide+fade direction transitions stay; add slow parallax
(foreground image translates at 0.6× of the swipe) on the brand slides.

### M3. Guest conversion without the wall

**Before:** Guests can browse and watch free content, but tapping chat input, tip,
or subscribe pushes the sign-in screen — context lost, friction spike.

**After:** Any gated action as a guest opens a **sign-in bottom sheet**:
"Tip as yourself — sign in to send support" with Continue with Google/Apple and a
dismiss button. Signing in completes **inside the sheet** and then *executes the
interrupted action automatically* (the tip you were about to send gets sent).
No re-navigation, no lost intent. This single pattern converts the guest funnel.

### M4. Go-live quick start: 8 decisions → 3

**Before:** Title, category, access, PPV price, source, slow mode, replay, co-host,
sub-only chat, consent, KYC gate — a form that takes 2+ minutes before the stream
starts. First-time creators bail here.

**After:** **Title (prefilled with last used / "LIVE: <category> with <name>") →
category chips → access (Public/Subs/PPV).** That's it. Everything else collapses
into "More options" (source, slow mode, replay, co-host, sub-only) with smart
defaults: phone source, replay on, slow mode on for public streams.
**"Go Live" is a full-width button pinned to the thumb zone at all times.**

Motion: tap Go Live → 3-2-1 countdown (each number 250 ms pop + fade) with a
camera-flash white overlay → "YOU'RE LIVE" banner slams in from top with a
spring, chat + viewer count fly in from the sides. Feels like an event, not a form.

### M5. Tip goals + live progress (revenue)

**Before:** Tips are one-way; the creator's goal is invisible; fans don't know what
"good support" looks like.

**After:** Creator sets a session goal ("$250 — new camera lens" or just "$250").
The live room shows a slim progress bar under the stream header with the goal,
current amount, and a "Top tippers" avatar row. Every tip advances the bar with an
animated fill. On 100%: confetti burst + haptic + auto-announce in chat
("GOAL HIT — 250/250 🎉" — no emoji in code, use icon). Backend: goals live in
`live_streams` (goal_amount, goal_label) + tips already flow through `transactions`.

### M6. Feed fixes (retention)

- **Following mode is broken for fans:** it only shows episodes from *subscribed*
  creators, so a fan who follows 10 creators but subscribes to 1 sees an empty
  timeline. Fix: Following shows episodes from followed **and** subscribed
  creators; sub-only episodes render with a lock badge + "Subscribe to watch"
  CTA instead of being hidden. (Follow events already exist in the `events` table.)
- **Continue watching rail:** above the episode grid, a horizontal rail of
  in-progress episodes with a progress bar under each card. Needs `watch_time`
  events (already tracked) aggregated into `episode_progress` per user.
- **Header declutter:** the feed header currently has wordmark + greeting +
  wallet pill + inbox + bell = 5 elements. Drop the inbox icon (messages move
  into the profile tab), keep wallet + bell. Greeting becomes one line:
  "Evening, Alex".

---

## Priority 2 — SHOULD-HAVE (next month)

### S1. Creator Studio becomes a dashboard, not a menu

**Before:** Studio is a list of links (vault, go live, earnings, analytics).
Creators see no numbers without digging.

**After:** Bento dashboard, first screen on the tab:
- **Today card** — revenue today, live viewers now, new subs, tips count (from
  `creator_stats` view, real data).
- **Quick actions row** — Go Live (primary, magenta), Upload, Earnings.
- **Latest episode card** with views/likes/tips and a sparkline of last-7-day
  views.
- Below: vault list. Numbers update via Realtime on `transactions` inserts so a
  tip lands on the dashboard within a second.

### S2. Payment speed: Apple/Google Pay + saved card

First checkout captures the card; every later payment is a single tap with the
stored method shown as "Pay $5 with •• 4242". Skip Stripe redirect entirely for
returning users. Expect 25–40% higher tip conversion.

### S3. Chat upgrades

- **Pinned message** — creator (or mod) can pin one message; renders as a bar
  under the stream header.
- **Mentions** — `@name` autocompletes from chat participants; mention gets a
  highlight color + optional push.
- **Quick reactions** — long-press a message → ❤️/🔥/😂 (icons only, no emoji)
  counter pops on the message.
- **Creator badge** — lime checkmark next to the streamer in chat.
- **Mod actions** — long-press → Mute 10m / Ban / Delete (creator + mods only).

### S4. Search

Global search from the Explore tab: creators, episodes, live streams, categories.
Debounced, results in 3 sections, keyboard-optimized. Explore is currently just
categories + creator grid — search is the missing discovery primitive.

### S5. Multi-tier subscriptions

**Before:** One price per creator. One tier means you either get the whale's full
LTV or the casual fan's nothing.

**After:** Two tiers per creator (e.g., $4.99 Base — all episodes; $12.99 VIP —
+ monthly private live + early drops). Tier picker lives in the Subscribe sheet
(horizontal tier cards with a "Most popular" badge on the middle one). Backend:
`subscriptions.tier` column + creator-set `sub_price_vip`.

### S6. Notification center v2

Group by type (Live / New episodes / Messages / Money) with a Live group pinned
to the top showing currently-live creators with a one-tap "Watch" button. The
in-app "X went live" banner (drop-down toast, 4 s, auto-dismiss, tap to join)
already has the push plumbing from `notify-live` — add it to the feed.

---

## Priority 3 — NICE-TO-HAVE

- **N1. Watch parties** — host syncs a PPV replay; up to 8 friends watch with
  shared chat. Retention + social growth.
- **N2. Tipper leaderboards** — per-creator monthly top tippers; top 3 get
  badges next to their chat name. Gamified spending.
- **N3. Creator streaks** — "Live 3× this week" streak flame in Studio; streak
  boosts discovery ranking. Creator-side retention.
- **N4. Promo codes** — creator generates codes (e.g., first-month-free) to post
  on socials; redemption counts as creator attribution.
- **N5. Accessibility & feel pass** — system haptics on every money action,
  `prefers-reduced-motion` respected app-wide, Dynamic Type audit.

---

## Motion & interaction spec

All springs are `useNativeDriver`-compatible (transform/opacity only). Budget:
max 5 concurrent animations on screen; nothing animated inside a scroll list
row except transforms.

| Action | Motion | Duration / easing |
|---|---|---|
| **Tip send** | Coin/gift flies from button to stream header in an arc, then the amount "stamps" into chat with a spring pop; progress bar (if goal) fills with a 400 ms ease-out | 350 ms spring (damping 0.7), arc 500 ms |
| **Subscribe** | Button label crossfades to "Subscribed ✓", crown icon drops in from above with overshoot, confetti burst, success haptic | 300 ms spring, overshoot 1.08 |
| **Unlock PPV** | Lock icon rotates 90° and fades as a light sweep crosses the video; playback starts under the sweep — the gate *dissolves*, no black flash | 450 ms ease-in-out |
| **Go live** | 3-2-1 countdown pops (scale 0.6→1.1→1), white flash 150 ms, "YOU'RE LIVE" banner spring-in, chat slides from right | 3 × 250 ms; flash 150 ms; banner 400 ms spring |
| **Join chat / send message** | Sent message slides up 8 pt + fades in; input bar springs up when focused; new incoming messages slide in from right with 6 pt travel | 180 ms each, staggered 40 ms |
| **Follow** | Pill morphs Follow → Following (background fills lime, label crossfades) with a checkmark draw-on | 250 ms |
| **Like / heart** | Double-tap spawns floating hearts (existing live-room hearts) — keep; episode cards get a 1.15× scale pop on the like icon | 300 ms spring |
| **Payment success** | Checkmark draws itself (stroke-dashoffset) inside the button, button shrinks to 0.96 then back, wallet balance rolls up like an odometer | 400 ms draw; 600 ms roll |
| **Tab switch** | Icon pops 1.15× and settles; Live tab pulses magenta ring when any stream is live (badge, not constant glow) | 200 ms spring |
| **Pull-to-refresh** | Custom spinner: lime ring with a POV wordmark glyph that completes one rotation | n/a (system gesture) |
| **Viewer count** | Numbers roll (odometer) on change instead of snapping | 300 ms |

**Performance guardrails:** transforms and opacity only (native driver);
no `LayoutAnimation` inside the feed/chat FlatLists; keep the Ken Burns zoom on
sign-in (already at 14 s) but gate it behind reduced-motion; blur only on static
overlays, never on scroll.

---

## Monetization summary (revenue impact order)

1. **M1 one-tap pay + in-context sheets** — removes the largest payment-friction
   drop-off. Highest impact per effort.
2. **M5 tip goals** — goal bars measurably raise average tip size (anchor effect)
   and give whales a completion target.
3. **S5 multi-tier subs** — captures mid-value fans without losing whales.
4. **S2 Apple/Google Pay** — same as #1 for the first payment.
5. **N2 tipper leaderboards** — status spending; feeds #2.
6. **N4 promo codes** — creator-driven acquisition loop.

## Retention summary (impact order)

1. M6 continue-watching + Following fix (fans see their content)
2. M3 guest → sign-in sheet (converts browsers without punishing them)
3. S6 live banners + notification grouping (re-engagement)
4. M2 shorter onboarding (more users reach content on day 0)
5. S3 chat social features (session length in live rooms)

## Build order

1. M1 (sheets + one-tap pay) — one shared component, three mount points
2. M2 + M3 (onboarding collapse, guest sheet)
3. M4 (go-live quick start)
4. M6 (feed fixes)
5. M5 (tip goals — backend + overlay)
6. S1 → S2 → S3 → S4 → S5 → S6
7. N-tier items as capacity allows
