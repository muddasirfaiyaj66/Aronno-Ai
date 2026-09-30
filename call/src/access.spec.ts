import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BadRequestException,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { assertConsultId, assertServiceSecret, readJoinCheck } from "./access.ts";

const CONSULT = "6abc0102103003f276496018";

describe("call access checks", () => {
  it("accepts only the matching bearer secret", () => {
    assert.doesNotThrow(() => assertServiceSecret("Bearer expected-secret", "expected-secret"));
    assert.throws(() => assertServiceSecret(undefined, "expected-secret"), UnauthorizedException);
    assert.throws(
      () => assertServiceSecret("Bearer other-secret", "expected-secret"),
      UnauthorizedException,
    );
    assert.throws(() => assertServiceSecret("Bearer expected-secret", ""), UnauthorizedException);
  });

  it("accepts a Mongo consult id only", () => {
    assert.doesNotThrow(() => assertConsultId(CONSULT));
    assert.throws(() => assertConsultId("not-an-id"), BadRequestException);
  });

  it("reads a successful join-check and rejects the API failures", () => {
    assert.deepEqual(
      readJoinCheck(200, { success: true, data: { userId: "user-1", displayName: "আমিনা" } }),
      { userId: "user-1", displayName: "আমিনা" },
    );
    assert.throws(() => readJoinCheck(500, null), ServiceUnavailableException);
    assert.throws(() => readJoinCheck(401, { success: false }), UnauthorizedException);
    assert.throws(() => readJoinCheck(400, { success: false }), BadRequestException);
  });
});
