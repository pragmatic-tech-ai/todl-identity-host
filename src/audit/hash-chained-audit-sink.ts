import { createHash } from "node:crypto";
import type { AuditEvent, IAuditSink } from "@pragmatic-tech-ai/todl-identity";
import { AuditTamperDetected } from "./audit-tamper-detected.js";
import { ChainedAuditRecord } from "./chained-audit-record.js";

export class HashChainedAuditSink implements IAuditSink
{
    private static readonly Genesis = "0".repeat(64);
    private static readonly Algo = "sha256";
    private static readonly Encoding = "hex";
    private static readonly FieldSep = "\u0000";
    private static readonly PairSep = "\u0001";
    private static readonly EntrySep = "\u0002";
    private static readonly LengthSep = ":";
    private static readonly NullMarker = "N";
    private static readonly ValueMarker = "V";

    private readonly chains = new Map<string, ChainedAuditRecord[]>();

    public constructor(private readonly backing?: IAuditSink)
    {
    }

    public Next(tenantId: string, event: AuditEvent): ChainedAuditRecord
    {
        const arr = this.chains.get(tenantId) ?? [];
        const prevHash = arr.length === 0 ? HashChainedAuditSink.Genesis : arr[arr.length - 1]!.Hash;
        const hash = this.Compute(prevHash, event);
        return new ChainedAuditRecord(event, arr.length, prevHash, hash);
    }

    public Append(record: ChainedAuditRecord): void
    {
        const existing = this.chains.get(record.Event.TenantId);
        const expectedSeq = existing === undefined ? 0 : existing.length;
        const expectedPrev = existing === undefined || existing.length === 0
            ? HashChainedAuditSink.Genesis
            : existing[existing.length - 1]!.Hash;
        if (record.Sequence !== expectedSeq || record.PrevHash !== expectedPrev)
        {
            throw new AuditTamperDetected(record.Event.TenantId, record.Sequence);
        }
        let arr = existing;
        if (arr === undefined)
        {
            arr = [];
            this.chains.set(record.Event.TenantId, arr);
        }
        arr.push(record);
    }

    public async Record(event: AuditEvent): Promise<void>
    {
        const record = this.Next(event.TenantId, event);
        this.Append(record);
        if (this.backing !== undefined)
        {
            await this.backing.Record(event);
        }
    }

    public Records(tenantId: string): readonly ChainedAuditRecord[]
    {
        return this.chains.get(tenantId) ?? [];
    }

    public Verify(tenantId: string): boolean
    {
        const chain = this.chains.get(tenantId) ?? [];
        let expectedPrev = HashChainedAuditSink.Genesis;
        for (let i = 0; i < chain.length; i++)
        {
            const r = chain[i]!;
            if (r.Sequence !== i || r.PrevHash !== expectedPrev || r.Hash !== this.Compute(r.PrevHash, r.Event))
            {
                return false;
            }
            expectedPrev = r.Hash;
        }
        return true;
    }

    // Canonical format: fields joined by FieldSep, in order
    //   prevHash, Kind, TenantId, PrincipalId, At (ISO-8601), Detail.
    // Every free-text value (TenantId, PrincipalId, detail keys/values) is length-prefixed
    // ("<len>:<text>") so separator characters inside values cannot shift boundaries.
    // PrincipalId is prefixed with NullMarker (null) or ValueMarker (present, even if ""),
    // so null and "" differ. Detail entries are sorted by key; each is "key PairSep value",
    // joined by EntrySep, with the entry count leading.
    private Compute(prevHash: string, event: AuditEvent): string
    {
        const entries = [...event.Detail.entries()].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
        const detail = entries
            .map(([k, v]) => this.Prefixed(k) + HashChainedAuditSink.PairSep + this.Prefixed(v))
            .join(HashChainedAuditSink.EntrySep);
        const principal = event.PrincipalId === null
            ? HashChainedAuditSink.NullMarker
            : HashChainedAuditSink.ValueMarker + this.Prefixed(event.PrincipalId);
        const canonical = [
            prevHash,
            String(event.Kind),
            this.Prefixed(event.TenantId),
            principal,
            event.At.toISOString(),
            String(entries.length) + HashChainedAuditSink.LengthSep + detail,
        ].join(HashChainedAuditSink.FieldSep);
        return createHash(HashChainedAuditSink.Algo).update(canonical).digest(HashChainedAuditSink.Encoding);
    }

    private Prefixed(text: string): string
    {
        return String(text.length) + HashChainedAuditSink.LengthSep + text;
    }
}
