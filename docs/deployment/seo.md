# Public metadata and branding

The canonical URL is https://coffee.yardsort.sh/. `packages/shared/site-meta.ts` owns the title, description, canonical link, Open Graph and Twitter large-image tags. Vite injects these into the game HTML and the guest landing page renders the same tags on the server, so crawlers need no JavaScript or login. Public play must be enabled for the guest landing page to return 200; invite-only login remains protected.

The preview is `/assets/brand/social-card-v1.png` (1200×630). Favicons include SVG, 32px PNG, legacy ICO and an opaque 180px Apple touch icon. These exact files, robots.txt and sitemap.xml are publicly readable with GET/HEAD. Gameplay assets, accounts and APIs retain their existing authentication. Admin, access, API and preview routes get noindex headers. Robots directives are indexing guidance, not access controls.

Editable sources: `assets/brand/social-card.svg`, `apps/web/public/favicon.svg`, and the existing branded logo PNG. Regenerate with `npm ci --include=dev && npm run assets:web-brand`; outputs are committed. The social-card text renderer uses available system Arial/sans-serif fonts, so exact rasterization may differ across systems. No AI generation or external image API is involved.

After merging and deployment, check the unauthenticated root HTML, favicon and social PNG on the custom domain. Existing platform previews and browser favicons can remain cached; use a platform's re-scrape/inspection tool where available. The sitemap can be submitted to Google Search Console after domain verification; it is optional and requires the owner's account. Metadata does not guarantee ranking or immediate reindexing.
