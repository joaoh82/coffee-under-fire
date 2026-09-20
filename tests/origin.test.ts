import { test } from "node:test";
import assert from "node:assert/strict";
import { allowedOrigin } from "../apps/server/src/origin";

test("LAN and arbitrary HTTPS tunnel hosts can use the same-origin API", () => {
  assert.equal(
    allowedOrigin("http://192.168.1.89:5173", "192.168.1.89:5173", 8787),
    true,
  );
  assert.equal(
    allowedOrigin(
      "https://random-playtest.example",
      "random-playtest.example",
      8787,
    ),
    true,
  );
  assert.equal(
    allowedOrigin("http://localhost:5173", "127.0.0.1:8787", 8787),
    true,
  );
  assert.equal(allowedOrigin(undefined, "localhost:8787", 8787), true);
});
test("unrelated browser origins and malformed origins remain rejected", () => {
  for (const origin of [
    "https://other.example",
    "null",
    "invalid",
    "https://playtest.example/path",
    "https://user@playtest.example",
    "ftp://playtest.example",
  ]) {
    assert.equal(allowedOrigin(origin, "playtest.example", 8787), false);
  }
});
