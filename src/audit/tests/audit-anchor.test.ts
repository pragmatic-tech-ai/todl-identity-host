import { test } from "node:test";
import assert from "node:assert/strict";
import { AuditEvent, AuditEventKind } from "@pragmatic-tech-ai/todl-identity";
import { HashChainedAuditSink } from "../hash-chained-audit-sink.js";
import { HmacAuditCheckpointSigner } from "../hmac-audit-checkpoint-signer.js";
import { AuditAnchor } from "../audit-anchor.js";
import { AuditAnchorMismatch } from "../audit-anchor-mismatch.js";
import { AuditAnchorReason } from "../audit-anchor-reason.js";
import { AuditCheckpoint } from "../audit-checkpoint.js";
import type { ChainedAuditRecord } from "../chained-audit-record.js";

class AuditAnchorFixtures
{
    public static Records(realm: string, n: number): readonly ChainedAuditRecord[]
    {
        const chain = new HashChainedAuditSink();
        for (let i = 0; i < n; i++)
        {
            const ev = new AuditEvent(AuditEventKind.AdminAction, realm, "p1", new Date("2026-01-01T00:00:00Z"), new Map([["i", String(i)]]));
            chain.Record(ev);
        }
        return chain.Records(realm);
    }

    public static Anchor(): AuditAnchor
    {
        return new AuditAnchor(new HmacAuditCheckpointSigner("k"), 1, () => new Date("2026-01-01T00:00:00Z"));
    }
}

test("Verify is a no-op when there is no checkpoint", () =>
{
    AuditAnchorFixtures.Anchor().Verify(AuditAnchorFixtures.Records("t1", 3), undefined);
});

test("Verify passes on a matching signed checkpoint", () =>
{
    const a = AuditAnchorFixtures.Anchor();
    const recs = AuditAnchorFixtures.Records("t1", 3);
    const cp = a.Build("t1", recs)!;
    a.Verify(recs, cp);
});

test("Verify throws Truncated when the live chain is shorter than the checkpoint", () =>
{
    const a = AuditAnchorFixtures.Anchor();
    const cp = a.Build("t1", AuditAnchorFixtures.Records("t1", 3))!;
    assert.throws(() => a.Verify(AuditAnchorFixtures.Records("t1", 2), cp), (e: unknown) => e instanceof AuditAnchorMismatch && e.Reason === AuditAnchorReason.Truncated);
});

test("Verify throws Diverged when the head at the anchored seq differs", () =>
{
    const a = AuditAnchorFixtures.Anchor();
    const at = "2026-01-01T00:00:00.000Z";
    const signed = new AuditCheckpoint("t1", 3, "not-the-real-head", at, new HmacAuditCheckpointSigner("k").Sign("t1", 3, "not-the-real-head", at));
    assert.throws(() => a.Verify(AuditAnchorFixtures.Records("t1", 3), signed), (e: unknown) => e instanceof AuditAnchorMismatch && e.Reason === AuditAnchorReason.Diverged);
});

test("Verify throws SignatureInvalid when the signature does not verify", () =>
{
    const a = AuditAnchorFixtures.Anchor();
    const recs = AuditAnchorFixtures.Records("t1", 3);
    const good = a.Build("t1", recs)!;
    const forged = new AuditCheckpoint(good.RealmId, good.Sequence, good.HeadHash, good.At, "deadbeef");
    assert.throws(() => a.Verify(recs, forged), (e: unknown) => e instanceof AuditAnchorMismatch && e.Reason === AuditAnchorReason.SignatureInvalid);
});

test("Build returns undefined for an empty chain and a signed checkpoint otherwise", () =>
{
    const a = AuditAnchorFixtures.Anchor();
    assert.equal(a.Build("t1", AuditAnchorFixtures.Records("t1", 0)), undefined);
    const cp = a.Build("t1", AuditAnchorFixtures.Records("t1", 2))!;
    assert.equal(cp.Sequence, 2);
});

test("DueFrom honours the interval", () =>
{
    const one = new AuditAnchor(new HmacAuditCheckpointSigner("k"), 1);
    assert.equal(one.DueFrom(1, 0), true);
    assert.equal(one.DueFrom(0, 0), false);
    const five = new AuditAnchor(new HmacAuditCheckpointSigner("k"), 5);
    assert.equal(five.DueFrom(4, 0), false);
    assert.equal(five.DueFrom(5, 0), true);
    assert.equal(five.DueFrom(10, 6), false);
    assert.equal(five.DueFrom(11, 6), true);
});

test("Verify reports SignatureInvalid before Truncated when both hold", () =>
{
    const a = AuditAnchorFixtures.Anchor();
    const forged = new AuditCheckpoint("t1", 9, "whatever", "2026-01-01T00:00:00.000Z", "deadbeef");
    assert.throws(() => a.Verify(AuditAnchorFixtures.Records("t1", 2), forged), (e: unknown) => e instanceof AuditAnchorMismatch && e.Reason === AuditAnchorReason.SignatureInvalid);
});

test("the constructor rejects a non-integer, NaN, or < 1 interval", () =>
{
    assert.throws(() => new AuditAnchor(new HmacAuditCheckpointSigner("k"), 0), RangeError);
    assert.throws(() => new AuditAnchor(new HmacAuditCheckpointSigner("k"), 1.5), RangeError);
    assert.throws(() => new AuditAnchor(new HmacAuditCheckpointSigner("k"), -1), RangeError);
    assert.throws(() => new AuditAnchor(new HmacAuditCheckpointSigner("k"), Number.NaN), RangeError);
});
