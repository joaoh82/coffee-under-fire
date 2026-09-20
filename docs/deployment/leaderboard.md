# Sharing and the community leaderboard

The report has three direct sharing options: Twitter, LinkedIn, and Generate Image. Twitter opens a prefilled text/link composer; LinkedIn opens its link-sharing page (it does not accept a custom score message through this link). Neither posts automatically. Generate Image creates a 1200×630 PNG locally with the current nickname, score, deliveries, survival time, game logo, Jev callout and game address. The preview offers Save PNG; users attach the downloaded file to social posts themselves. No image-generation API or additional Jev call is used. Image generation failure shows a retryable message. Editing the name clears the old preview. Links use the clean game root, never session credentials or private query parameters.

After a completed live Jev run, the player can explicitly submit a public nickname (1–40 visible characters) with their score. The game shows that the name and score are public and recommends a nickname. Guests do not need to create a password or disclose an email. Names are not unique or verified identities.

`/leaderboard` and `GET /api/leaderboard` are public and filter by map, difficulty and mission/endless mode. They show the top 20, using each player identity's best run for that category. The report shows the first five. Points match the report: rounded base score plus survival seconds. Ties sort by submission time, then entry ID. Public records exclude invite IDs, network identifiers, login data and session tokens. A five-second cache is bounded to 12 category combinations and invalidated on submission/moderation.

## Integrity and limitations

This is explicitly a **community, browser-reported leaderboard, not an anti-cheat-verified ranking**. The browser remains authoritative for physics, combat and final score. Server checks prevent simple unauthenticated and cross-user submissions, duplicate-run spam, changed run categories, obvious invalid totals, and submissions without a real Jev decision; they cannot prove an honest client simulation. Do not use these rankings for prizes or trusted competitive outcomes without moving scoring server-side or validating authenticated replays.

The server records map/difficulty/mode at session creation. Submissions require strict live mode, a valid guest/invite login, ownership of the game session, matching network for guests, at least one successfully recorded Jev decision, and bounded timing/statistics. The submission window is one hour after the run ends. Runs created before the feature deploy cannot submit because they lack bound category metadata. Mock/replay/visual fixtures do not rank.

One immutable submission is allowed per session. Retrying returns the existing entry without changing the name or score. A submitted run ends its game session. Existing daily Jev budgets and game limits still apply; leaderboard reads and posts do not call Jev. Anonymous users can change identities, so “best per player” means the server's guest/invite identity, not a verified person.

## Moderation and persistence

`/admin` has a Leaderboard moderation table for the latest 100 visible submissions. **Remove entry** hides an entry and leaves a tombstone, preventing resubmission of the same game. Older best scores may become visible after a newer score is removed. Server-side name checks use the Obscenity English preset plus additional adult-content terms, including common obfuscation. This is a best-effort filter, not comprehensive multilingual or semantic moderation; false positives and evasions remain possible. There is no identity verification or appeal system. Public names require owner moderation.

Entries persist in the existing SQLite database on Render's disk. The table is bounded at 100,000 submissions (including hidden entries); retention/pagination beyond this public pilot is not implemented. All writes and moderation require exact-origin authenticated requests. The public listing catches malformed URLs and database failures rather than exposing internals or crashing the process.

Deploy through the existing Blueprint; no new secrets or services are needed. After deployment, complete one live run, submit a nickname, open `/leaderboard` in an incognito browser and verify the entry. Check sharing on a mobile device and the desktop fallback, then remove the test entry through admin. Offline tests do not establish actual social posting or hosted leaderboard acceptance.

Local validation on 2026-09-20: build and 109 offline tests passed, including public HTTP listing/submission with an explicitly synthetic completed run, malformed URL survival, ownership/network checks, duplicate handling, persistence, moderation, and share text/link sanitation. End-game visual fixture was inspected in the browser. Native OS sharing and hosted live-run submission still need device/deployment acceptance. No social post was sent during testing.

## Guest display names

Guest admission offers an optional display name. It is stored in a new `invites.display_name` column, separate from the generated ID, and admin shows both. The additive migration runs automatically; no new secrets are needed. Existing players have an empty display name.

The authenticated `/api/profile` endpoint returns only the current player's ID and display name. At game over, this pre-fills the editable leaderboard name, using the full guest ID when no name exists. Submitting a valid score remembers the chosen name for subsequent runs; it does not rename older scores. Duplicate score submissions do not change the profile. Names are not unique or verified, and publishing a guest ID makes that pseudonym visible on the board (it is not an authentication credential).

Admission and score submission both enforce the name policy on the server. Names support Unicode and emoji, up to 40 characters; invisible formatting, line breaks and HTML angle brackets are rejected. The browser explains public visibility before submitting a score. Name filtering makes no Jev/API calls. Owners should continue reviewing public names; this filter does not guarantee that every sexual phrase or non-English profanity will be caught.

Wave announcements appear for the first 2.6 simulation seconds of each wave, including wave 1. They do not intercept controls or pause the mission, hide while paused/recovering, and respect reduced-motion preferences.
