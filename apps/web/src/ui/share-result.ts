import { reportPoints } from "../../../../packages/shared/leaderboard";
export function shareMessage(data: {
  score: number;
  time: number;
  deliveries: number;
}) {
  return `I scored ${reportPoints(data).toLocaleString("en-US")} points and delivered ${data.deliveries} coffees in Coffee Under Fire! Can you survive NPCs powered by Jev AI?`;
}
export function cleanShareUrl(origin: string) {
  try {
    const url = new URL(origin);
    if (
      url.protocol === "https:" &&
      !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
    )
      return new URL("/", url.origin).href;
  } catch {}
  return "https://coffee-under-fire.onrender.com/";
}
