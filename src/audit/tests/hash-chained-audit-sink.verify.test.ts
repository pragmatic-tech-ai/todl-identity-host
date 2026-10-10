import { test } from "node:test";
import assert from "node:assert/strict";
import { AuditEvent, AuditEventKind } from "@pragmatic-tech-ai/todl-identity";
import { HashChainedAuditSink } from "../hash-chained-audit-sink.js";
import { ChainedAuditRecord } from "../chained-audit-record.js";

class Fixture
{
    public static readonly T1 = "t1";
    public static readonly T2 = "t2";
    public static readonly Principal = "p1";
    public static readonly Key = "k";
    public static readonly Value = "v";
    public static readonly IndexKey = "i";
    public static readonly Hacked = "HACKED";
    public static readonly BadHashChar = "f";
    public static readonly HashLength = 64;
    public static readonly ChainLength = 3;

    public static Event(tenantId: string, detail?: ReadonlyMap<string, string>): AuditEvent
    {
        const d = detail ?? new Map([[Fixture.Key, Fixture.Value]]);
        return new AuditEvent(AuditEventKind.Authentication, tenantId, Fixture.Principal, new Date(0), d);
    }

    public static Indexed(tenantId: string, index: string): AuditEvent
    {
        return Fixture.Event(tenantId, new Map([[Fixture.IndexKey, index]]));
    }

    public static async Three(sink: HashChainedAuditSink): Promise<void>
    {
        for (let i = 0; i < Fixture.ChainLength; i++)
        {
            await sink.Record(Fixture.Indexed(Fixture.T1, String(i)));
        }
    }

    public static Chain(sink: HashChainedAuditSink, tenantId: string): ChainedAuditRecord[]
    {
        return sink.Records(tenantId) as ChainedAuditRecord[];
    }
}

test("Verify is true for an untampered chain (incl. empty and single)", async () =>
{
    const sink = new HashChainedAuditSink();
    assert.equal(sink.Verify(Fixture.T1), true);
    await sink.Record(Fixture.Event(Fixture.T1));
    assert.equal(sink.Verify(Fixture.T1), true);
    await sink.Record(Fixture.Event(Fixture.T1));
    assert.equal(sink.Verify(Fixture.T1), true);
});

test("Verify detects an edited event", async () =>
{
    const sink = new HashChainedAuditSink();
    await Fixture.Three(sink);
    const chain = Fixture.Chain(sink, Fixture.T1);
    const victim = chain[1]!;
    chain[1] = new ChainedAuditRecord(Fixture.Indexed(Fixture.T1, Fixture.Hacked), victim.Sequence, victim.PrevHash, victim.Hash);
    assert.equal(sink.Verify(Fixture.T1), false);
});

test("Verify detects an altered stored hash", async () =>
{
    const sink = new HashChainedAuditSink();
    await Fixture.Three(sink);
    const chain = Fixture.Chain(sink, Fixture.T1);
    const victim = chain[2]!;
    chain[2] = new ChainedAuditRecord(victim.Event, victim.Sequence, victim.PrevHash, Fixture.BadHashChar.repeat(Fixture.HashLength));
    assert.equal(sink.Verify(Fixture.T1), false);
});

test("Verify detects reordering", async () =>
{
    const sink = new HashChainedAuditSink();
    await Fixture.Three(sink);
    const chain = Fixture.Chain(sink, Fixture.T1);
    const tmp = chain[0]!;
    chain[0] = chain[1]!;
    chain[1] = tmp;
    assert.equal(sink.Verify(Fixture.T1), false);
});

test("per-tenant isolation: appending to t2 never breaks t1's Verify", async () =>
{
    const sink = new HashChainedAuditSink();
    await Fixture.Three(sink);
    await sink.Record(Fixture.Event(Fixture.T2));
    assert.equal(sink.Verify(Fixture.T1), true);
    assert.equal(sink.Verify(Fixture.T2), true);
});
