/**
 * Durable Neon Postgres staging adapter for the signed gateway.
 * Requires externally supplied, authenticated node-postgres style pool.connect().
 * Never instantiate the pool with connection strings in source.
 */
import { randomUUID } from 'node:crypto';
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;
export function postgresEvidenceAdapter(pool) {
  if (!pool || typeof pool.connect !== 'function') throw Error('postgres_pool_required');
  return Object.freeze({
    async commitUnique({replayKey,dedupeKey,envelopeDigest,record}) {
      if(typeof replayKey !== 'string' || replayKey.length > 260 || !ID.test(replayKey.split(':')[0])) throw Error('invalid_replay_key');
      if(typeof dedupeKey !== 'string' || dedupeKey.length > 390) throw Error('invalid_dedupe_key');
      if(!/^[a-f0-9]{64}$/.test(envelopeDigest)) throw Error('invalid_envelope_digest');
      if(!record || typeof record !== 'object' || typeof record.source !== 'string' || typeof record.proboOrgId !== 'string') throw Error('invalid_record');
      const client=await pool.connect();
      let inTx=false;
      try {
        await client.query('BEGIN');
        inTx=true;
        const replay=await client.query(
          'INSERT INTO rosie_grc_bridge.replay_nonce (replay_key) VALUES ($1) ON CONFLICT DO NOTHING RETURNING replay_key',
          [replayKey]
        );
        if(replay.rowCount !== 1) throw Error('replay_detected');
        const receiptId='receipt-'+randomUUID();
        const insert=await client.query(
          `INSERT INTO rosie_grc_bridge.evidence_inbox
             (receipt_id,dedupe_key,source_node,target_probo_org,envelope_digest,event_json,received_at)
             VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7)
             ON CONFLICT (dedupe_key) DO NOTHING RETURNING receipt_id`,
          [receiptId,dedupeKey,record.source,record.proboOrgId,envelopeDigest,JSON.stringify(record.event),record.receivedAt]
        );
        let result;
        if(insert.rowCount===1) result={status:'accepted',receiptId};
        else {
          const prior=await client.query(
            'SELECT receipt_id, envelope_digest FROM rosie_grc_bridge.evidence_inbox WHERE dedupe_key=$1 FOR UPDATE',
            [dedupeKey]
          );
          if(prior.rowCount!==1 || prior.rows[0].envelope_digest.trim() !== envelopeDigest) throw Error('conflicting_duplicate');
          result={status:'duplicate',receiptId:prior.rows[0].receipt_id};
        }
        await client.query('COMMIT');inTx=false;
        return result;
      } catch(error) {
        if(inTx) await client.query('ROLLBACK');
        throw error;
      } finally { client.release(); }
    }
  });
}
