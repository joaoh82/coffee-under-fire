# Sharing and the community leaderboard

Players can share their result from the mission report. Supported browsers open the native share sheet on a button click; other browsers offer X, WhatsApp, and a copyable message/link. Cancelling native sharing does not post or copy anything. Links include only the game root, never session credentials or private query parameters. Opening a social compose page is not evidence that a post was published.

After a completed live Jev run, the player can explicitly submit a public nickname (1–24 letters/numbers and simple punctuation) with their score. The game shows that the name and score are public and recommends a nickname. Guests do not need to create a password or disclose an email. Names are not unique or verified identities.

`/leaderboard` and `GET /api/leaderboard` are public and filter by map, difficulty and mission/endless mode. They show the top 20, using each player identity's best run for that category. The report shows the first five. Points match the report: rounded base score plus survival seconds. Ties sort by submission time, then entry ID. Public records exclude invite IDs, network identifiers, login data and session tokens. A five-second cache is bounded to 12 category combinations and invalidated on submission/moderation.

## Integrity and limitations

This is explicitly a **community, browser-reported leaderboard, not an anti-cheat-verified ranking**. The browser remains authoritative for physics, combat and final score. Server checks prevent simple unauthenticated and cross-user submissions, duplicate-run spam, changed run categories, obvious invalid totals, and submissions without a real Jev decision; they cannot prove an honest client simulation. Do not use these rankings for prizes or trusted competitive outcomes without moving scoring server-side or validating authenticated replays.

The server records map/difficulty/mode at session creation. Submissions require strict live mode, a valid guest/invite login, ownership of the game session, matching network for guests, at least one successfully recorded Jev decision, and bounded timing/statistics. The submission window is one hour after the run ends. Runs created before the feature deploy cannot submit because they lack bound category metadata. Mock/replay/visual fixtures do not rank.

One immutable submission is allowed per session. Retrying returns the existing entry without changing the name or score. A submitted run ends its game session. Existing daily Jev budgets and game limits still apply; leaderboard reads and posts do not call Jev. Anonymous users can change identities, so “best per player” means the server's guest/invite identity, not a verified person.

## Moderation and persistence

`/admin` has a Leaderboard moderation table for the latest 100 visible submissions. **Remove entry** hides an entry and leaves a tombstone, preventing resubmission of the same game. Older best scores may become visible after a newer score is removed. There is no automatic profanity filter, identity verification or appeal system. Public names require owner moderation.

Entries persist in the existing SQLite database on Render's disk. The table is bounded at 100,000 submissions (including hidden entries); retention/pagination beyond this public pilot is not implemented. All writes and moderation require exact-origin authenticated requests. The public listing catches malformed URLs and database failures rather than exposing internals or crashing the process.

Deploy through the existing Blueprint; no new secrets or services are needed. After deployment, complete one live run, submit a nickname, open `/leaderboard` in an incognito browser and verify the entry. Check sharing on a mobile device and the desktop fallback, then remove the test entry through admin. Offline tests do not establish actual social posting or hosted leaderboard acceptance.

Local validation on 2026-09-20: build and 109 offline tests passed, including public HTTP listing/submission with an explicitly synthetic completed run, malformed URL survival, ownership/network checks, duplicate handling, persistence, moderation, and share text/link sanitation. End-game visual fixture was inspected in the browser. Native OS sharing and hosted live-run submission still need device/deployment acceptance. No social post was sent during testing.
