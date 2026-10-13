import { test } from "node:test";
import assert from "node:assert/strict";
import { HmacAuditCheckpointSigner } from "../hmac-audit-checkpoint-signer.js";

test("sign then verify round-trips", () =>
{
    const s = new HmacAuditCheckpointSigner("k");
    const sig = s.Sign("t1", 3, "abc", "2026-01-01T00:00:00.000Z");
    assert.ok(sig.length > 0);
    assert.equal(s.Verify("t1", 3, "abc", "2026-01-01T00:00:00.000Z", sig), true);
});

test("verify rejects a tampered sequence, head hash, at, or tenant", () =>
{
    const s = new HmacAuditCheckpointSigner("k");
    const sig = s.Sign("t1", 3, "abc", "2026-01-01T00:00:00.000Z");
    assert.equal(s.Verify("t1", 4, "abc", "2026-01-01T00:00:00.000Z", sig), false);
    assert.equal(s.Verify("t1", 3, "abd", "2026-01-01T00:00:00.000Z", sig), false);
    assert.equal(s.Verify("t1", 3, "abc", "2026-01-02T00:00:00.000Z", sig), false);
    assert.equal(s.Verify("t2", 3, "abc", "2026-01-01T00:00:00.000Z", sig), false);
});

test("verify returns false (never throws) on an unequal-length or invalid signature", () =>
{
    const s = new HmacAuditCheckpointSigner("k");
    assert.equal(s.Verify("t1", 3, "abc", "2026-01-01T00:00:00.000Z", "deadbeef"), false);
    assert.equal(s.Verify("t1", 3, "abc", "2026-01-01T00:00:00.000Z", ""), false);
    assert.equal(s.Verify("t1", 3, "abc", "2026-01-01T00:00:00.000Z", "zz"), false);
    const good = s.Sign("t1", 3, "abc", "2026-01-01T00:00:00.000Z");
    assert.equal(s.Verify("t1", 3, "abc", "2026-01-01T00:00:00.000Z", good + "zz"), false);
    assert.equal(s.Verify("t1", 3, "abc", "2026-01-01T00:00:00.000Z", good + "0"), false);
    assert.equal(s.Verify("t1", 3, "abc", "2026-01-01T00:00:00.000Z", good.toUpperCase()), false);
    assert.equal(s.Verify("t1", 3, "abc", "2026-01-01T00:00:00.000Z", "é".repeat(32)), false);
    assert.equal(s.Verify("t1", 3, "abc", "2026-01-01T00:00:00.000Z", "a".repeat(63) + "é"), false);
});

test("a different key produces a different signature", () =>
{
    const a = new HmacAuditCheckpointSigner("k1");
    const b = new HmacAuditCheckpointSigner("k2");
    const sig = a.Sign("t1", 3, "abc", "2026-01-01T00:00:00.000Z");
    assert.equal(b.Verify("t1", 3, "abc", "2026-01-01T00:00:00.000Z", sig), false);
});

test("length-prefixing prevents field-boundary collisions", () =>
{
    const s = new HmacAuditCheckpointSigner("k");
    // ("ab",1,...) must not collide with ("a",... ) via run-together fields.
    const x = s.Sign("ab", 1, "h", "2026-01-01T00:00:00.000Z");
    const y = s.Sign("a", 1, "bh", "2026-01-01T00:00:00.000Z");
    assert.notEqual(x, y);
});
