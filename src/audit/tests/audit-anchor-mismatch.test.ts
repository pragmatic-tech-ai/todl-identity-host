import { test } from "node:test";
import assert from "node:assert/strict";
import { AuditTamperDetected } from "../audit-tamper-detected.js";
import { AuditAnchorMismatch } from "../audit-anchor-mismatch.js";
import { AuditAnchorReason } from "../audit-anchor-reason.js";
import { AuditCheckpoint } from "../audit-checkpoint.js";

test("AuditAnchorMismatch is an AuditTamperDetected carrying tenant, seq, reason", () =>
{
    const err = new AuditAnchorMismatch("t1", 7, AuditAnchorReason.Truncated);
    assert.ok(err instanceof AuditTamperDetected);
    assert.equal(err.name, "AuditAnchorMismatch");
    assert.equal(err.TenantId, "t1");
    assert.equal(err.Seq, 7);
    assert.equal(err.Reason, AuditAnchorReason.Truncated);
    assert.ok(err.message.includes("t1"));
    assert.ok(err.message.includes("truncated"));
});

test("AuditCheckpoint exposes readonly fields", () =>
{
    const cp = new AuditCheckpoint("t1", 3, "abc", "2026-01-01T00:00:00.000Z", "sig");
    assert.equal(cp.TenantId, "t1");
    assert.equal(cp.Sequence, 3);
    assert.equal(cp.HeadHash, "abc");
    assert.equal(cp.At, "2026-01-01T00:00:00.000Z");
    assert.equal(cp.Signature, "sig");
});
