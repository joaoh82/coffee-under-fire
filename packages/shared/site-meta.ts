export const SITE_URL = "https://coffee.yardsort.sh/";
export const SITE_TITLE = "Coffee Under Fire | Free AI-Powered Browser Shooter";
export const SITE_DESCRIPTION =
  "Survive enemy waves, deliver coffee and chase high scores in a free low-poly browser shooter. Every NPC’s tactical decisions are powered by Jev AI.";
export const ICON_HEAD = `<link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32"><link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180"><meta name="theme-color" content="#23382b">`;
export const SITE_HEAD = `<title>${SITE_TITLE}</title>
<meta name="description" content="${SITE_DESCRIPTION}">
<link rel="canonical" href="${SITE_URL}">
<meta name="robots" content="index,follow,max-image-preview:large">
<meta property="og:type" content="website"><meta property="og:site_name" content="Coffee Under Fire"><meta property="og:locale" content="en_US">
<meta property="og:title" content="${SITE_TITLE}"><meta property="og:description" content="${SITE_DESCRIPTION}"><meta property="og:url" content="${SITE_URL}">
<meta property="og:image" content="${SITE_URL}assets/brand/social-card-v1.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:type" content="image/png"><meta property="og:image:alt" content="Coffee Under Fire: Hold the line. Don’t spill the coffee. NPCs powered by Jev AI.">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${SITE_TITLE}"><meta name="twitter:description" content="${SITE_DESCRIPTION}"><meta name="twitter:image" content="${SITE_URL}assets/brand/social-card-v1.png"><meta name="twitter:image:alt" content="Coffee Under Fire browser game, powered by Jev AI.">
${ICON_HEAD}`;
export const PUBLIC_BRAND_PATHS = new Set([
  "/favicon.ico",
  "/favicon.svg",
  "/favicon-32.png",
  "/apple-touch-icon.png",
  "/assets/brand/social-card-v1.png",
  "/robots.txt",
  "/sitemap.xml",
]);
