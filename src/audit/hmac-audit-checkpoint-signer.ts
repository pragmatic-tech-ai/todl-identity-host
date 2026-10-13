import { createHmac, timingSafeEqual } from "node:crypto";
import type { IAuditCheckpointSigner } from "./audit-checkpoint-signer.js";

export class HmacAuditCheckpointSigner implements IAuditCheckpointSigner
{
    private static readonly Algo = "sha256";
    private static readonly Encoding = "hex";
    private static readonly FieldSep = "\u0000";
    private static readonly LengthSep = ":";

    private readonly key: Buffer;

    public constructor(key: string | Buffer)
    {
        this.key = typeof key === "string" ? Buffer.from(key, "utf8") : key;
    }

    public Sign(tenantId: string, sequence: number, headHash: string, at: string): string
    {
        return createHmac(HmacAuditCheckpointSigner.Algo, this.key)
            .update(this.Canonical(tenantId, sequence, headHash, at))
            .digest(HmacAuditCheckpointSigner.Encoding);
    }

    public Verify(tenantId: string, sequence: number, headHash: string, at: string, signature: string): boolean
    {
        const expected = Buffer.from(this.Sign(tenantId, sequence, headHash, at), HmacAuditCheckpointSigner.Encoding);
        const given = Buffer.from(signature, HmacAuditCheckpointSigner.Encoding);
        if (expected.length !== given.length || expected.length === 0)
        {
            return false;
        }
        return timingSafeEqual(expected, given);
    }

    // Fields joined by FieldSep; every free-text field is length-prefixed ("<len>:<text>") so a
    // separator inside a value cannot shift boundaries. The key is never logged or embedded.
    private Canonical(tenantId: string, sequence: number, headHash: string, at: string): string
    {
        return [
            this.Prefixed(tenantId),
            String(sequence),
            this.Prefixed(headHash),
            this.Prefixed(at),
        ].join(HmacAuditCheckpointSigner.FieldSep);
    }

    private Prefixed(text: string): string
    {
        return String(text.length) + HmacAuditCheckpointSigner.LengthSep + text;
    }
}
