import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CONSULT_STATUS_BN } from "./consult.ts";

describe("CONSULT_STATUS_BN", () => {
  it("names every consult status in Bangla", () => {
    assert.equal(CONSULT_STATUS_BN.requested, "অনুরোধ পাঠানো");
    assert.equal(CONSULT_STATUS_BN.ringing, "কল আসছে");
    assert.equal(CONSULT_STATUS_BN.in_call, "কলে");
    assert.equal(CONSULT_STATUS_BN.completed, "পরামর্শ প্রস্তুত");
    assert.equal(Object.keys(CONSULT_STATUS_BN).length, 7);
  });
});
