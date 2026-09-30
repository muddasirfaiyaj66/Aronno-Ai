import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { RoomStore } from "./store.ts";

describe("RoomStore", () => {
  it("opens and closes a room in memory when Mongo is not configured", async () => {
    delete process.env.CALL_MONGODB_URI;
    const store = new RoomStore();
    await store.init();
    await store.upsertOpen("abc123", "consult-abc123");
    const open = await store.get("abc123");
    assert.equal(open?.status, "open");
    assert.equal(open?.roomName, "consult-abc123");
    await store.close("abc123");
    const closed = await store.get("abc123");
    assert.equal(closed?.status, "closed");
    assert.ok(closed?.closedAt instanceof Date);
  });
});
