import { test } from "node:test";
import assert from "node:assert/strict";
import { Realm, RealmKind } from "@pragmatic-tech-ai/todl-identity";
import { MappingRealmResolver } from "../mapping-realm-resolver.js";
import { SingleRealmResolver } from "../single-realm-resolver.js";

class Fixture
{
    public static readonly KnownHint = "acme.example";
    public static readonly UnknownHint = "unknown";
    public static readonly AnyHint = "anything";
    public static readonly EmptyHint = "";
    public static Realm(id: string): Realm { return new Realm(id, RealmKind.Saas, id); }
}

test("MappingRealmResolver returns the mapped realm and null on a miss", async () =>
{
    const t1 = Fixture.Realm("t1");
    const resolver = new MappingRealmResolver(new Map([[Fixture.KnownHint, t1]]));
    assert.equal(await resolver.Resolve(Fixture.KnownHint), t1);
    assert.equal(await resolver.Resolve(Fixture.UnknownHint), null);
});

test("SingleRealmResolver always returns its realm regardless of hint", async () =>
{
    const solo = Fixture.Realm("solo");
    const resolver = new SingleRealmResolver(solo);
    assert.equal(await resolver.Resolve(Fixture.AnyHint), solo);
    assert.equal(await resolver.Resolve(Fixture.EmptyHint), solo);
});
