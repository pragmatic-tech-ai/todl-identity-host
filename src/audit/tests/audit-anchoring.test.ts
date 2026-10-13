import { test } from "node:test";
import assert from "node:assert/strict";
import { AuditEvent, AuditEventKind } from "@pragmatic-tech-ai/todl-identity";
import type { AuditCheckpoint } from "../audit-checkpoint.js";
import { HashChainedAuditSink } from "../hash-chained-audit-sink.js";
import { HmacAuditCheckpointSigner } from "../hmac-audit-checkpoint-signer.js";
import { InMemoryAuditCheckpointStore } from "../in-memory-audit-checkpoint-store.js";
import { AuditAnchor } from "../audit-anchor.js";
import { AuditAnchoring } from "../audit-anchoring.js";
import { AuditAnchorMismatch } from "../audit-anchor-mismatch.js";

class CountingCheckpointStore extends InMemoryAuditCheckpointStore
{
    public Appends = 0;

    public override Append(checkpoint: AuditCheckpoint): Promise<void>
    {
        this.Appends++;
        return super.Append(checkpoint);
    }
}

class AuditAnchoringFixtures
{
    public static readonly Tenant = "t1";
    private static readonly Principal = "p1";
    private static readonly Key = "k";
    private static readonly At = new Date("2026-01-01T00:00:00Z");

    public static Event(index: number): AuditEvent
    {
        return new AuditEvent(AuditEventKind.AdminAction, AuditAnchoringFixtures.Tenant, AuditAnchoringFixtures.Principal, AuditAnchoringFixtures.At, new Map([["i", String(index)]]));
    }

    public static Anchoring(store: InMemoryAuditCheckpointStore, interval = 1): AuditAnchoring
    {
        return new AuditAnchoring(new AuditAnchor(new HmacAuditCheckpointSigner(AuditAnchoringFixtures.Key), interval, () => AuditAnchoringFixtures.At), store);
    }
}

test("VerifyAll seeds a checkpoint for an un-anchored head and does not re-write on a clean reopen", async () =>
{
    const store = new CountingCheckpointStore();
    const chain = new HashChainedAuditSink();
    await chain.Record(AuditAnchoringFixtures.Event(0));
    await chain.Record(AuditAnchoringFixtures.Event(1));
    await AuditAnchoringFixtures.Anchoring(store).VerifyAll(chain, [AuditAnchoringFixtures.Tenant]);
    assert.equal((await store.Latest(AuditAnchoringFixtures.Tenant))!.Sequence, 2);
    assert.equal(store.Appends, 1);
    await AuditAnchoringFixtures.Anchoring(store).VerifyAll(chain, [AuditAnchoringFixtures.Tenant]);
    assert.equal(store.Appends, 1);
    assert.equal((await store.Latest(AuditAnchoringFixtures.Tenant))!.Sequence, 2);
});

test("VerifyAll detects truncate-to-zero via the union of chain and store tenants", async () =>
{
    const store = new InMemoryAuditCheckpointStore();
    const full = new HashChainedAuditSink();
    await full.Record(AuditAnchoringFixtures.Event(0));
    await AuditAnchoringFixtures.Anchoring(store).VerifyAll(full, [AuditAnchoringFixtures.Tenant]);
    const empty = new HashChainedAuditSink();
    await assert.rejects(AuditAnchoringFixtures.Anchoring(store).VerifyAll(empty, []), AuditAnchorMismatch);
});

test("CheckpointIfDue respects interval N across multiple checkpoints", async () =>
{
    const store = new InMemoryAuditCheckpointStore();
    const chain = new HashChainedAuditSink();
    const anchoring = AuditAnchoringFixtures.Anchoring(store, 2);
    const tenant = AuditAnchoringFixtures.Tenant;
    await anchoring.VerifyAll(chain, []);
    await chain.Record(AuditAnchoringFixtures.Event(0));
    await anchoring.CheckpointIfDue(tenant, chain.Records(tenant));
    assert.equal(await store.Latest(tenant), undefined);
    await chain.Record(AuditAnchoringFixtures.Event(1));
    await anchoring.CheckpointIfDue(tenant, chain.Records(tenant));
    assert.equal((await store.Latest(tenant))!.Sequence, 2);
    await chain.Record(AuditAnchoringFixtures.Event(2));
    await anchoring.CheckpointIfDue(tenant, chain.Records(tenant));
    assert.equal((await store.Latest(tenant))!.Sequence, 2);
    await chain.Record(AuditAnchoringFixtures.Event(3));
    await anchoring.CheckpointIfDue(tenant, chain.Records(tenant));
    assert.equal((await store.Latest(tenant))!.Sequence, 4);
});
