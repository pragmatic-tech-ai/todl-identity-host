import { createHmac, timingSafeEqual } from "node:crypto";
import type { IAuditCheckpointSigner } from "./audit-checkpoint-signer.js";

export class HmacAuditCheckpointSigner implements IAuditCheckpointSigner
{
    private static readonly Algo = "sha256";
    private static readonly Encoding = "hex";
    private static readonly TextEncoding = "utf8";
    private static readonly FieldSep = "\u0000";
    private static readonly LengthSep = ":";

    private readonly key: Buffer;

    public constructor(key: string | Buffer)
    {
        this.key = typeof key === "string" ? Buffer.from(key, HmacAuditCheckpointSigner.TextEncoding) : Buffer.from(key);
    }

    public Sign(realmId: string, sequence: number, headHash: string, at: string): string
    {
        return createHmac(HmacAuditCheckpointSigner.Algo, this.key)
            .update(this.Canonical(realmId, sequence, headHash, at))
            .digest(HmacAuditCheckpointSigner.Encoding);
    }

    public Verify(realmId: string, sequence: number, headHash: string, at: string, signature: string): boolean
    {
        const expected = Buffer.from(this.Sign(realmId, sequence, headHash, at), HmacAuditCheckpointSigner.TextEncoding);
        const given = Buffer.from(signature, HmacAuditCheckpointSigner.TextEncoding);
        if (expected.length !== given.length)
        {
            return false;
        }
        return timingSafeEqual(expected, given);
    }

    // Fields joined by FieldSep; every free-text field is length-prefixed ("<len>:<text>") so a
    // separator inside a value cannot shift boundaries. The key is never logged or embedded.
    private Canonical(realmId: string, sequence: number, headHash: string, at: string): string
    {
        return [
            this.Prefixed(realmId),
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
