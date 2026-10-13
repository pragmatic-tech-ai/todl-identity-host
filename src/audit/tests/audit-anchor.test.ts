import { test } from "node:test";
import assert from "node:assert/strict";
import { AuditEvent, AuditEventKind } from "@pragmatic-tech-ai/todl-identity";
import { HashChainedAuditSink } from "../hash-chained-audit-sink.js";
import { HmacAuditCheckpointSigner } from "../hmac-audit-checkpoint-signer.js";
import { AuditAnchor } from "../audit-anchor.js";
import { AuditAnchorMismatch } from "../audit-anchor-mismatch.js";
import { AuditAnchorReason } from "../audit-anchor-reason.js";
import { AuditCheckpoint } from "../audit-checkpoint.js";

const records = (tenant: string, n: number) =>
{
    const chain = new HashChainedAuditSink();
    for (let i = 0; i < n; i++)
    {
        const ev = new AuditEvent(AuditEventKind.AdminAction, tenant, "p1", new Date("2026-01-01T00:00:00Z"), new Map([["i", String(i)]]));
        chain.Record(ev);
    }
    return chain.Records(tenant);
};

const anchor = () => new AuditAnchor(new HmacAuditCheckpointSigner("k"), 1, () => new Date("2026-01-01T00:00:00Z"));

test("Verify is a no-op when there is no checkpoint", () =>
{
    anchor().Verify(records("t1", 3), undefined);
});

test("Verify passes on a matching signed checkpoint", () =>
{
    const a = anchor();
    const recs = records("t1", 3);
    const cp = a.Build("t1", recs)!;
    a.Verify(recs, cp);
});

test("Verify throws Truncated when the live chain is shorter than the checkpoint", () =>
{
    const a = anchor();
    const cp = a.Build("t1", records("t1", 3))!;
    assert.throws(() => a.Verify(records("t1", 2), cp), (e: unknown) => e instanceof AuditAnchorMismatch && e.Reason === AuditAnchorReason.Truncated);
});

test("Verify throws Diverged when the head at the anchored seq differs", () =>
{
    const a = anchor();
    const cp = new AuditCheckpoint("t1", 3, "not-the-real-head", "2026-01-01T00:00:00.000Z", "");
    const signed = new AuditCheckpoint(cp.TenantId, cp.Sequence, cp.HeadHash, cp.At, new HmacAuditCheckpointSigner("k").Sign(cp.TenantId, cp.Sequence, cp.HeadHash, cp.At));
    assert.throws(() => a.Verify(records("t1", 3), signed), (e: unknown) => e instanceof AuditAnchorMismatch && e.Reason === AuditAnchorReason.Diverged);
});

test("Verify throws SignatureInvalid when the signature does not verify", () =>
{
    const a = anchor();
    const recs = records("t1", 3);
    const good = a.Build("t1", recs)!;
    const forged = new AuditCheckpoint(good.TenantId, good.Sequence, good.HeadHash, good.At, "deadbeef");
    assert.throws(() => a.Verify(recs, forged), (e: unknown) => e instanceof AuditAnchorMismatch && e.Reason === AuditAnchorReason.SignatureInvalid);
});

test("Build returns undefined for an empty chain and a signed checkpoint otherwise", () =>
{
    const a = anchor();
    assert.equal(a.Build("t1", records("t1", 0)), undefined);
    const cp = a.Build("t1", records("t1", 2))!;
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

test("the constructor rejects a non-integer or < 1 interval", () =>
{
    assert.throws(() => new AuditAnchor(new HmacAuditCheckpointSigner("k"), 0));
    assert.throws(() => new AuditAnchor(new HmacAuditCheckpointSigner("k"), 1.5));
});
