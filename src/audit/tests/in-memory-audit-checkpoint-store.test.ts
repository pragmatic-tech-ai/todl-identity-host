import { test } from "node:test";
import assert from "node:assert/strict";
import { InMemoryAuditCheckpointStore } from "../in-memory-audit-checkpoint-store.js";
import { AuditCheckpoint } from "../audit-checkpoint.js";

test("Latest returns the highest-sequence checkpoint for a realm; Realms lists distinct ids", async () =>
{
    const s = new InMemoryAuditCheckpointStore();
    assert.equal(await s.Latest("t1"), undefined);
    await s.Append(new AuditCheckpoint("t1", 1, "h1", "a1", "s1"));
    await s.Append(new AuditCheckpoint("t1", 2, "h2", "a2", "s2"));
    await s.Append(new AuditCheckpoint("t2", 1, "h3", "a3", "s3"));
    assert.equal((await s.Latest("t1"))!.Sequence, 2);
    assert.equal((await s.Latest("t1"))!.HeadHash, "h2");
    assert.deepEqual([...(await s.Realms())].sort(), ["t1", "t2"]);
});
