import { test } from "node:test";
import assert from "node:assert/strict";
import { AuditEvent, AuditEventKind } from "@pragmatic-tech-ai/todl-identity";
import { HashChainedAuditSink } from "../hash-chained-audit-sink.js";
import { HmacAuditCheckpointSigner } from "../hmac-audit-checkpoint-signer.js";
import { InMemoryAuditCheckpointStore } from "../in-memory-audit-checkpoint-store.js";
import { AuditAnchor } from "../audit-anchor.js";
import { AuditAnchoring } from "../audit-anchoring.js";
import { AuditAnchorMismatch } from "../audit-anchor-mismatch.js";

const ev = (t: string, i: number) => new AuditEvent(AuditEventKind.AdminAction, t, "p1", new Date("2026-01-01T00:00:00Z"), new Map([["i", String(i)]]));
const anchoring = (store: InMemoryAuditCheckpointStore, interval = 1) => new AuditAnchoring(new AuditAnchor(new HmacAuditCheckpointSigner("k"), interval, () => new Date("2026-01-01T00:00:00Z")), store);

test("VerifyAll seeds a checkpoint for an un-anchored head and verifies clean on reopen", async () =>
{
    const store = new InMemoryAuditCheckpointStore();
    const chain = new HashChainedAuditSink();
    chain.Record(ev("t1", 0));
    chain.Record(ev("t1", 1));
    await anchoring(store).VerifyAll(chain, ["t1"]);
    assert.equal((await store.Latest("t1"))!.Sequence, 2);
    // reopen: same chain, fresh anchoring, must verify
    await anchoring(store).VerifyAll(chain, ["t1"]);
});

test("VerifyAll detects truncate-to-zero via the union of chain and store tenants", async () =>
{
    const store = new InMemoryAuditCheckpointStore();
    const full = new HashChainedAuditSink();
    full.Record(ev("t1", 0));
    await anchoring(store).VerifyAll(full, ["t1"]);
    // Now a chain where t1 has NO records (all events deleted) but the store still has t1.
    const empty = new HashChainedAuditSink();
    await assert.rejects(anchoring(store).VerifyAll(empty, []), AuditAnchorMismatch);
});

test("CheckpointIfDue advances the anchor at interval 1 and respects interval N", async () =>
{
    const store = new InMemoryAuditCheckpointStore();
    const chain = new HashChainedAuditSink();
    const a = anchoring(store, 2);
    await a.VerifyAll(chain, []);
    chain.Record(ev("t1", 0));
    await a.CheckpointIfDue("t1", chain.Records("t1"));
    assert.equal(await store.Latest("t1"), undefined); // 1 < interval 2
    chain.Record(ev("t1", 1));
    await a.CheckpointIfDue("t1", chain.Records("t1"));
    assert.equal((await store.Latest("t1"))!.Sequence, 2);
});
