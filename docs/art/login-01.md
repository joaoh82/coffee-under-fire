# Login presentation pass

The entry pages now share the game's existing logo, olive background, cream field-pass panel and brass accents. Guest entry keeps an optional display name and puts invite sign-in and privacy details in expandable sections. Jev, GitHub, leaderboard and optional coffee support remain visible. Managed and legacy invite forms and the owner login use the same shell.

Only the exact logo asset path is added to unauthenticated static access. Authentication handlers, origin checks, cookies, budgets and credential validation are unchanged.

Validation: production build and all 130 tests pass, including unauthenticated logo delivery and protection of model assets. Desktop and 320px mobile layouts were inspected in the browser using an isolated, in-memory guest fixture. At 320px, document width is 320px and the verification container has the required 300px width. The Cloudflare widget did not render in the local preview; live challenge completion was not tested. Existing guest tests exercise verification behavior with a fixture transport.
