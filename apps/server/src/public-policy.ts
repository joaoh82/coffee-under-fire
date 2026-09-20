export type PublicSettings = {
  publicEnabled: boolean;
  dailyCents: number;
  guestCents: number;
  ipCents: number;
  ipConcurrent: number;
};
export const DEFAULT_PUBLIC_SETTINGS: PublicSettings = {
  publicEnabled: false,
  dailyCents: 200,
  guestCents: 25,
  ipCents: 50,
  ipConcurrent: 2,
};
export class AccessLimit extends Error {
  constructor(public code: string) {
    super(code);
  }
}
export function limitMessage(code: string) {
  if (code === "daily_budget_exhausted")
    return "The general’s coffee fund is empty for today. We’ve reached today’s AI gameplay budget. Free play returns after midnight UTC.";
  if (code === "guest_daily_budget_exhausted")
    return "You’ve used today’s guest gameplay allowance. Come back after midnight UTC for another coffee run.";
  if (code === "ip_daily_budget_exhausted")
    return "This network has reached today’s gameplay allowance. Please try again after midnight UTC.";
  if (code === "ip_session_limit")
    return "This network already has the maximum number of active games. Close another game or wait 90 seconds for its slot to expire.";
  if (code === "public_closed")
    return "Public guest play is currently closed. Invited players can still sign in.";
  return "Guest access is temporarily unavailable. Please try again later.";
}
