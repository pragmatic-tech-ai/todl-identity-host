import { test } from "node:test";
import assert from "node:assert/strict";
import { AuditEvent, AuditEventKind } from "@pragmatic-tech-ai/todl-identity";
import { FakeAuditSink } from "@pragmatic-tech-ai/todl-identity/testing";
import { HashChainedAuditSink } from "../hash-chained-audit-sink.js";

class Fixture
{
    public static Event(realmId: string, detail: ReadonlyMap<string, string> = new Map(), principal: string | null = "p1"): AuditEvent
    {
        return new AuditEvent(AuditEventKind.Authentication, realmId, principal, new Date(0), detail);
    }

    public static async FirstHash(event: AuditEvent): Promise<string>
    {
        const sink = new HashChainedAuditSink();
        await sink.Record(event);
        return sink.Records(event.RealmId)[0]!.Hash;
    }
}

test("records chain with sequence, genesis prevHash, and linked hashes", async () =>
{
    const sink = new HashChainedAuditSink();
    await sink.Record(Fixture.Event("t1"));
    await sink.Record(Fixture.Event("t1"));
    const chain = sink.Records("t1");
    assert.equal(chain.length, 2);
    assert.equal(chain[0]!.Sequence, 0);
    assert.equal(chain[1]!.Sequence, 1);
    assert.equal(chain[0]!.PrevHash, "0".repeat(64)); // genesis
    assert.equal(chain[1]!.PrevHash, chain[0]!.Hash);  // linked
    assert.notEqual(chain[0]!.Hash, chain[1]!.Hash);
    assert.match(chain[0]!.Hash, /^[0-9a-f]{64}$/);
});

test("a different detail yields a different hash (injective enough)", async () =>
{
    const sink = new HashChainedAuditSink();
    await sink.Record(Fixture.Event("t1", new Map([["a", "1"]])));
    const other = new HashChainedAuditSink();
    await other.Record(Fixture.Event("t1", new Map([["a", "2"]])));
    assert.notEqual(sink.Records("t1")[0]!.Hash, other.Records("t1")[0]!.Hash);
});

test("null vs empty principal, and boundary-shifting details, hash differently", async () =>
{
    assert.notEqual(await Fixture.FirstHash(Fixture.Event("t1", new Map(), null)), await Fixture.FirstHash(Fixture.Event("t1", new Map(), "")));
    const a = await Fixture.FirstHash(Fixture.Event("t1", new Map([["a", "b\u0002c\u0001d"]])));
    const b = await Fixture.FirstHash(Fixture.Event("t1", new Map([["a", "b"], ["c", "d"]])));
    assert.notEqual(a, b);
});

test("detail key order does not change the hash", async () =>
{
    const a = await Fixture.FirstHash(Fixture.Event("t1", new Map([["a", "1"], ["b", "2"]])));
    const b = await Fixture.FirstHash(Fixture.Event("t1", new Map([["b", "2"], ["a", "1"]])));
    assert.equal(a, b);
});

test("composes over a backing sink, forwarding every event once", async () =>
{
    const backing = new FakeAuditSink();
    const sink = new HashChainedAuditSink(backing);
    await sink.Record(Fixture.Event("t1"));
    await sink.Record(Fixture.Event("t2"));
    assert.equal(backing.Events.length, 2);
});

test("Records of an unknown realm is empty", () =>
{
    assert.deepEqual([...new HashChainedAuditSink().Records("nope")], []);
});
