import { test } from "node:test";
import assert from "node:assert/strict";
import { IdpDirectorySnapshot } from "@pragmatic-tech-ai/todl-identity";
import { InMemoryIdpDirectoryStore } from "../in-memory-idp-directory-store.js";

test("in-memory store round-trips per tenant and returns null for unknown", async () =>
{
    const store = new InMemoryIdpDirectoryStore();
    const a = IdpDirectorySnapshot.NonAuthoritative(new Date(1));
    await store.Save("t1", a);
    assert.equal(await store.Get("t1"), a);
    assert.equal(await store.Get("t2"), null);
});
