export const DEFAULT_SUPPORT_URL = "https://ko-fi.com/thepolyglotprogrammer";

export function supportLink(value: string | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      !["ko-fi.com", "buymeacoffee.com", "www.buymeacoffee.com"].includes(
        url.hostname,
      )
    )
      return null;
    return url.href;
  } catch {
    return null;
  }
}
export function SupportCallout({
  url = import.meta.env.VITE_SUPPORT_URL ?? DEFAULT_SUPPORT_URL,
}: {
  url?: string;
}) {
  const href = supportLink(url);
  if (!href) return null;
  return (
    <aside className="support-callout" aria-label="Optional support">
      <span aria-hidden="true">☕</span>
      <div>
        <strong>
          The general gets the coffee. The developer gets the API bill.
        </strong>
        <p>
          Free to play. Jev powers the NPCs, and every mission uses paid AI
          calls. Fancy helping keep the coffee flowing?
        </p>
        <a href={href} target="_blank" rel="noopener noreferrer">
          Buy the developer a coffee <span aria-hidden="true">↗</span>
        </a>
        <small>
          Completely optional. No gameplay perks—just a grateful developer.
        </small>
      </div>
    </aside>
  );
}
