import { test } from "node:test";
import assert from "node:assert/strict";
import { Tenant, TenantKind } from "@pragmatic-tech-ai/todl-identity";
import { MappingTenantResolver } from "../mapping-tenant-resolver.js";
import { SingleTenantResolver } from "../single-tenant-resolver.js";

class Fixture
{
    public static readonly KnownHint = "acme.example";
    public static readonly UnknownHint = "unknown";
    public static readonly AnyHint = "anything";
    public static readonly EmptyHint = "";
    public static Tenant(id: string): Tenant { return new Tenant(id, TenantKind.Saas, id); }
}

test("MappingTenantResolver returns the mapped tenant and null on a miss", async () =>
{
    const t1 = Fixture.Tenant("t1");
    const resolver = new MappingTenantResolver(new Map([[Fixture.KnownHint, t1]]));
    assert.equal(await resolver.Resolve(Fixture.KnownHint), t1);
    assert.equal(await resolver.Resolve(Fixture.UnknownHint), null);
});

test("SingleTenantResolver always returns its tenant regardless of hint", async () =>
{
    const solo = Fixture.Tenant("solo");
    const resolver = new SingleTenantResolver(solo);
    assert.equal(await resolver.Resolve(Fixture.AnyHint), solo);
    assert.equal(await resolver.Resolve(Fixture.EmptyHint), solo);
});
