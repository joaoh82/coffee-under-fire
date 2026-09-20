import { test } from "node:test";
import assert from "node:assert/strict";
import { supportLink } from "../apps/web/src/ui/SupportCallout";
test("optional support link accepts real provider URLs and rejects unsafe or lookalike links", () => {
  assert.equal(supportLink(undefined), null);
  for (const url of [
    "javascript:alert(1)",
    "http://ko-fi.com/test",
    "https://ko-fi.com.evil.example/test",
    "https://user:password@ko-fi.com/test",
    "not a url",
  ])
    assert.equal(supportLink(url), null);
  assert.equal(
    supportLink("https://ko-fi.com/example"),
    "https://ko-fi.com/example",
  );
  assert.equal(
    supportLink("https://buymeacoffee.com/example"),
    "https://buymeacoffee.com/example",
  );
});

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SupportCallout } from "../apps/web/src/ui/SupportCallout";
test("support stays absent when explicitly disabled and renders an optional external link when configured", () => {
  assert.equal(
    renderToStaticMarkup(createElement(SupportCallout, { url: "" })),
    "",
  );
  const html = renderToStaticMarkup(
    createElement(SupportCallout, { url: "https://ko-fi.com/example" }),
  );
  assert.match(html, /Completely optional/);
  assert.match(html, /No gameplay perks/);
  assert.match(html, /noopener noreferrer/);
  assert.match(html, /paid AI calls/);
  assert.ok(!html.includes("iframe"));
});
