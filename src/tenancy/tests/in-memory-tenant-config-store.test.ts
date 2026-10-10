import { test } from "node:test";
import assert from "node:assert/strict";
import { DelegationDepth, IdentityConfig } from "@pragmatic-tech-ai/todl-identity";
import { InMemoryTenantConfigStore } from "../in-memory-tenant-config-store.js";

class Fixture
{
    public static Config(packId: string): IdentityConfig
    {
        return new IdentityConfig(packId, DelegationDepth.AuthnDirectory, new Map(), new Map(), new Map());
    }
}

test("Save then Get returns the stored config; List reflects keys; absent is null", async () =>
{
    const store = new InMemoryTenantConfigStore();
    assert.equal(await store.Get("t1"), null);
    await store.Save("t1", Fixture.Config("packA"));
    await store.Save("t2", Fixture.Config("packB"));
    assert.equal((await store.Get("t1"))?.PackId, "packA");
    assert.deepEqual([...(await store.List())].sort(), ["t1", "t2"]);
    await store.Save("t1", Fixture.Config("packC")); // overwrite
    assert.equal((await store.Get("t1"))?.PackId, "packC");
});
