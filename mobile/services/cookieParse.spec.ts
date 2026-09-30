import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseSetCookie, splitCombinedSetCookie } from "./cookieParse.ts";

describe("cookieParse", () => {
  it("keeps the refresh cookie when Expires contains a comma", () => {
    const header = [
      "aronno_access=access-jwt; Max-Age=604800; Path=/api; Expires=Wed, 07 Oct 2026 12:00:00 GMT; HttpOnly",
      "aronno_refresh=refresh-raw; Max-Age=2592000; Path=/api; Expires=Wed, 30 Oct 2026 12:00:00 GMT; HttpOnly",
    ].join(", ");
    const parts = splitCombinedSetCookie(header);
    assert.equal(parts.length, 2);
    assert.equal(parseSetCookie(parts[0])?.name, "aronno_access");
    assert.equal(parseSetCookie(parts[1])?.name, "aronno_refresh");
    assert.equal(parseSetCookie(parts[1])?.value, "refresh-raw");
    const expires = parseSetCookie(parts[0])?.expires ?? 0;
    assert.ok(expires > Date.now());
  });

  it("ignores a broken Expires date and still uses Max-Age", () => {
    const parsed = parseSetCookie("aronno_refresh=abc; Max-Age=10; Expires=not-a-date");
    assert.equal(parsed?.name, "aronno_refresh");
    assert.ok((parsed?.expires ?? 0) > Date.now());
  });
});
