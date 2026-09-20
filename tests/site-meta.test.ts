import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SITE_HEAD, PUBLIC_BRAND_PATHS } from "../packages/shared/site-meta";
test("public metadata has canonical URL, crawlable share image and branded icons", () => {
  assert.match(
    SITE_HEAD,
    /rel="canonical" href="https:\/\/coffee.yardsort.sh\/"/,
  );
  assert.match(SITE_HEAD, /name="description"/);
  assert.match(
    SITE_HEAD,
    /property="og:image" content="https:\/\/coffee.yardsort.sh\/assets\/brand\/social-card-v1.png"/,
  );
  assert.match(SITE_HEAD, /summary_large_image/);
  assert.match(SITE_HEAD, /rel="icon"/);
  assert.ok(!PUBLIC_BRAND_PATHS.has("/assets/models/slice_soldier.glb"));
  assert.ok(!PUBLIC_BRAND_PATHS.has("/api/session"));
});
test("committed brand exports have expected PNG dimensions and legacy ICO signature", () => {
  for (const [file, width, height] of [
    ["assets/brand/social-card-v1.png", 1200, 630],
    ["favicon-32.png", 32, 32],
    ["apple-touch-icon.png", 180, 180],
  ] as const) {
    const data = readFileSync("apps/web/public/" + file);
    assert.equal(data.subarray(1, 4).toString(), "PNG");
    assert.equal(data.readUInt32BE(16), width);
    assert.equal(data.readUInt32BE(20), height);
  }
  const ico = readFileSync("apps/web/public/favicon.ico");
  assert.equal(ico.readUInt16LE(2), 1);
  assert.equal(ico.readUInt16LE(4), 1);
});
