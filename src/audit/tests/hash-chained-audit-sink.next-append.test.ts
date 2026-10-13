import { test } from "node:test";
import assert from "node:assert/strict";
import { AuditEvent, AuditEventKind } from "@pragmatic-tech-ai/todl-identity";
import { FakeAuditSink } from "@pragmatic-tech-ai/todl-identity/testing";
import { AuditTamperDetected } from "../audit-tamper-detected.js";
import { ChainedAuditRecord } from "../chained-audit-record.js";
import { HashChainedAuditSink } from "../hash-chained-audit-sink.js";

class Fixture
{
    public static readonly Tenant = "t1";

    public static Event(): AuditEvent
    {
        return new AuditEvent(AuditEventKind.Authentication, Fixture.Tenant, "p1", new Date(0), new Map());
    }
}

test("Next is pure: identical results and no chain growth", () =>
{
    const sink = new HashChainedAuditSink();
    const a = sink.Next(Fixture.Tenant, Fixture.Event());
    const b = sink.Next(Fixture.Tenant, Fixture.Event());
    assert.equal(a.Hash, b.Hash);
    assert.equal(a.PrevHash, b.PrevHash);
    assert.equal(a.Sequence, b.Sequence);
    assert.equal(sink.Records(Fixture.Tenant).length, 0);
});

test("Append(Next) yields the same chain as Record", async () =>
{
    const viaRecord = new HashChainedAuditSink();
    await viaRecord.Record(Fixture.Event());
    const viaAppend = new HashChainedAuditSink();
    viaAppend.Append(viaAppend.Next(Fixture.Tenant, Fixture.Event()));
    const a = viaRecord.Records(Fixture.Tenant);
    const b = viaAppend.Records(Fixture.Tenant);
    assert.equal(b.length, 1);
    assert.equal(a.length, 1);
    assert.equal(b[0]!.Hash, a[0]!.Hash);
    assert.equal(b[0]!.PrevHash, a[0]!.PrevHash);
    assert.equal(b[0]!.Sequence, a[0]!.Sequence);
});

test("Append rejects a wrong sequence", () =>
{
    const sink = new HashChainedAuditSink();
    const good = sink.Next(Fixture.Tenant, Fixture.Event());
    const bad = new ChainedAuditRecord(good.Event, 5, good.PrevHash, good.Hash);
    assert.throws(() => sink.Append(bad), AuditTamperDetected);
    assert.equal(sink.Records(Fixture.Tenant).length, 0);
});

test("Append of a multi-record chain links and verifies", () =>
{
    const sink = new HashChainedAuditSink();
    const count = 4;
    for (let i = 0; i < count; i++)
    {
        sink.Append(sink.Next(Fixture.Tenant, Fixture.Event()));
    }
    const chain = sink.Records(Fixture.Tenant);
    assert.equal(chain.length, count);
    assert.equal(sink.Verify(Fixture.Tenant), true);
    for (let i = 1; i < count; i++)
    {
        assert.equal(chain[i]!.PrevHash, chain[i - 1]!.Hash);
    }
});

test("Append with wrong prevHash on a non-empty chain throws and leaves chain unchanged", () =>
{
    const sink = new HashChainedAuditSink();
    sink.Append(sink.Next(Fixture.Tenant, Fixture.Event()));
    const next = sink.Next(Fixture.Tenant, Fixture.Event());
    const bad = new ChainedAuditRecord(next.Event, next.Sequence, "f".repeat(64), next.Hash);
    assert.throws(() => sink.Append(bad), AuditTamperDetected);
    assert.equal(sink.Records(Fixture.Tenant).length, 1);
    assert.equal(sink.Verify(Fixture.Tenant), true);
});

test("Append rejects a wrong prevHash", () =>
{
    const sink = new HashChainedAuditSink();
    const good = sink.Next(Fixture.Tenant, Fixture.Event());
    const bad = new ChainedAuditRecord(good.Event, good.Sequence, "f".repeat(64), good.Hash);
    assert.throws(() => sink.Append(bad), AuditTamperDetected);
    assert.equal(sink.Records(Fixture.Tenant).length, 0);
});

test("Record still appends and forwards to backing", async () =>
{
    const backing = new FakeAuditSink();
    const sink = new HashChainedAuditSink(backing);
    const event = Fixture.Event();
    await sink.Record(event);
    assert.equal(sink.Records(Fixture.Tenant).length, 1);
    assert.equal(backing.Events.length, 1);
    assert.equal(backing.Events[0], event);
});
