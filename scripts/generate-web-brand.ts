import { readFileSync, writeFileSync } from "node:fs";
import { Resvg } from "@resvg/resvg-js";
const root = "apps/web/public/";
const icon = readFileSync(root + "favicon.svg", "utf8");
for (const [file, size] of [
  ["favicon-32.png", 32],
  ["apple-touch-icon.png", 180],
] as const)
  writeFileSync(
    root + file,
    new Resvg(icon, { fitTo: { mode: "width", value: size } }).render().asPng(),
  );
const logo = readFileSync(
  root + "assets/brand/coffee-under-fire-logo-v1.png",
).toString("base64");
const social = readFileSync("assets/brand/social-card.svg", "utf8")
  .replace("{{LOGO}}", "data:image/png;base64," + logo)
  .replace(
    "{{ICON}}",
    icon
      .trim()
      .replace(/^<svg[^>]*>/, "")
      .replace(/<\/svg>$/, ""),
  );
writeFileSync(
  root + "assets/brand/social-card-v1.png",
  new Resvg(social).render().asPng(),
);
// PNG-compressed ICO directory for older clients requesting /favicon.ico.
const png = new Resvg(icon, { fitTo: { mode: "width", value: 32 } })
  .render()
  .asPng();
const header = Buffer.alloc(22);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(1, 4);
header[6] = 32;
header[7] = 32;
header.writeUInt16LE(1, 10);
header.writeUInt16LE(32, 12);
header.writeUInt32LE(png.length, 14);
header.writeUInt32LE(22, 18);
writeFileSync(root + "favicon.ico", Buffer.concat([header, png]));
