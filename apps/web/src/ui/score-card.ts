import { reportPoints } from "../../../../packages/shared/leaderboard";
import { cleanShareUrl } from "./share-result";
export async function generateScoreCard(
  data: { score: number; time: number; deliveries: number },
  name: string,
  url: string,
): Promise<string> {
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 630;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw Error("Image generation is unavailable in this browser.");
  const logo = new Image();
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      logo.onload = logo.onerror = null;
      reject(Error("Logo loading timed out. Please try again."));
    }, 10000);
    logo.onload = () => {
      clearTimeout(timeout);
      resolve();
    };
    logo.onerror = () => {
      clearTimeout(timeout);
      reject(Error("Could not load the game logo. Please try again."));
    };
    logo.src = "/assets/brand/coffee-under-fire-logo-v1.png";
  });
  ctx.fillStyle = "#22382b";
  ctx.fillRect(0, 0, 1200, 630);
  ctx.fillStyle = "#304a35";
  for (let i = 0; i < 10; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 170 - 200, 630);
    ctx.lineTo(i * 170 + 170, 0);
    ctx.lineTo(i * 170 + 215, 0);
    ctx.lineTo(i * 170 - 155, 630);
    ctx.fill();
  }
  ctx.fillStyle = "#eee4be";
  ctx.fillRect(30, 30, 1140, 570);
  ctx.fillStyle = "#dac992";
  ctx.fillRect(750, 30, 420, 570);
  const fit = Math.min(370 / logo.width, 180 / logo.height);
  ctx.drawImage(logo, 64, 53, logo.width * fit, logo.height * fit);
  const label = (
    text: string,
    x: number,
    y: number,
    size: number,
    color: string,
    maxWidth = 620,
  ) => {
    ctx.fillStyle = color;
    ctx.font = `800 ${size}px system-ui, sans-serif`;
    while (ctx.measureText(text).width > maxWidth && size > 15) {
      size--;
      ctx.font = `800 ${size}px system-ui, sans-serif`;
    }
    ctx.fillText(text, x, y);
  };
  label("FIELD REPORT", 68, 276, 17, "#86613a");
  label(name.trim() || "Coffee recruit", 68, 330, 38, "#263f2d");
  label(reportPoints(data).toLocaleString("en-US"), 64, 435, 100, "#263f2d");
  label("POINTS EARNED", 68, 469, 17, "#586347");
  label(`${data.deliveries} COFFEE DELIVERIES`, 792, 270, 22, "#344b35", 340);
  const seconds = Math.floor(data.time);
  label(
    `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")} SURVIVED`,
    792,
    318,
    22,
    "#344b35",
    340,
  );
  label("Can you beat this?", 792, 397, 25, "#344b35", 340);
  ctx.fillStyle = "#ae512b";
  ctx.fillRect(791, 423, 331, 62);
  label("GO TRY IT →", 820, 465, 28, "#fff4d3", 285);
  ctx.fillStyle = "#344b35";
  ctx.fillRect(68, 512, 1064, 2);
  label("NPCs powered by Jev AI", 68, 558, 20, "#344b35", 410);
  label(new URL(cleanShareUrl(url)).host, 560, 558, 22, "#344b35", 570);
  return canvas.toDataURL("image/png");
}
