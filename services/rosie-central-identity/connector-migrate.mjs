/**
 * Connector staging tables, scoped exclusively to rosie_identity_mfa_staging.
 * No customer enrollment, billing effects, provider API calls or token migration.
 * Application queries are authenticated server-side; no direct client DB access.
 */
import {pool} from './auth.mjs';
export async function migrateConnectorStorage(){
 const db=await pool.query('select current_database() db');
 if(db.rows[0]?.db!=='rosie_identity_mfa_staging')throw Error('isolated_connector_database_required');
 const statements=[
 "CREATE SCHEMA IF NOT EXISTS rosie_connector",
 "REVOKE ALL ON SCHEMA rosie_connector FROM PUBLIC",
 `CREATE TABLE IF NOT EXISTS rosie_connector.oauth_transaction(
 state_hash char(64) PRIMARY KEY CHECK(state_hash ~ '^[a-f0-9]{64}$'),
 provider_key text NOT NULL CHECK(provider_key IN ('googleworkspace','dropbox')),
 organization_id text NOT NULL CHECK(organization_id ~ '^[a-f0-9]{24}$'),
 product_key text NOT NULL CHECK(product_key IN ('bob','directd','insureiq','settlementiq','emailiq')),
 central_subject text NOT NULL,
 session_hash char(64) NOT NULL,
 scopes jsonb NOT NULL CHECK(jsonb_typeof(scopes)='array'),
 verifier_cipher bytea NOT NULL,
 verifier_iv bytea NOT NULL CHECK(octet_length(verifier_iv)=12),
 created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL,
 consumed_at timestamptz,
 revoked_at timestamptz,
 CHECK(expires_at>created_at AND expires_at<=created_at+interval '5 minutes'))`,
 "CREATE INDEX IF NOT EXISTS idx_rosie_connector_oauth_expires ON rosie_connector.oauth_transaction(expires_at)",
 `CREATE TABLE IF NOT EXISTS rosie_connector.provider_connection(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 organization_id text NOT NULL,
 product_key text NOT NULL,
 central_subject text NOT NULL,
 provider_key text NOT NULL CHECK(provider_key IN ('googleworkspace','dropbox')),
 provider_subject_hash char(64),
 state text NOT NULL DEFAULT 'pending_verification' CHECK(state IN ('pending_verification','authorized','needs_reauth','revoked','blocked')),
 scopes jsonb NOT NULL CHECK(jsonb_typeof(scopes)='array'),
 access_token_cipher bytea,
 access_token_iv bytea CHECK(access_token_iv IS NULL OR octet_length(access_token_iv)=12),
 refresh_token_cipher bytea,
 refresh_token_iv bytea CHECK(refresh_token_iv IS NULL OR octet_length(refresh_token_iv)=12),
 token_expires_at timestamptz,
 last_verified_at timestamptz,
 revoked_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now())`,
 "CREATE INDEX IF NOT EXISTS idx_rosie_connector_org ON rosie_connector.provider_connection(organization_id,product_key,provider_key)",
 `CREATE TABLE IF NOT EXISTS rosie_connector.audit(
 event_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 provider_key text NOT NULL,
 action text NOT NULL,
 result text NOT NULL,
 org_hash char(64),
 subject_hash char(64),
 occurred_at timestamptz NOT NULL DEFAULT now())`,
 "CREATE INDEX IF NOT EXISTS idx_rosie_connector_audit ON rosie_connector.audit(occurred_at DESC)",
 "REVOKE ALL ON ALL TABLES IN SCHEMA rosie_connector FROM PUBLIC"
 ];
 const c=await pool.connect();
 try{await c.query('BEGIN');for(const statement of statements)await c.query(statement);await c.query('COMMIT');return {isolated:true,tables:3}}
 catch(e){await c.query('ROLLBACK');throw e}finally{c.release()}
}
