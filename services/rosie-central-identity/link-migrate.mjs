/**
 * Non-destructive, repeatable staging migration.
 * No changes to managed Neon Auth, Base44 production accounts or billing.
 */
import {pool} from './auth.mjs';
export async function migrateRosieLink(){
 const name=await pool.query('SELECT current_database() AS name');
 if(name.rows[0]?.name!=='rosie_identity_mfa_staging')
   throw Error('Refusing to migrate non-isolated identity database');
 const statements=[
 "CREATE SCHEMA IF NOT EXISTS rosie_identity_link",
 "REVOKE ALL ON SCHEMA rosie_identity_link FROM PUBLIC",
 "CREATE TABLE IF NOT EXISTS rosie_identity_link.product_nonce(product_key text NOT NULL CHECK(product_key IN ('bob','directd','insureiq','settlementiq','emailiq')),request_nonce text NOT NULL,seen_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(product_key,request_nonce))",
 "CREATE TABLE IF NOT EXISTS rosie_identity_link.link_challenge(challenge_hash char(64) PRIMARY KEY CHECK(challenge_hash ~ '^[a-f0-9]{64}$'),product_key text NOT NULL CHECK(product_key IN ('bob','directd','insureiq','settlementiq','emailiq')),organization_id text NOT NULL CHECK(organization_id ~ '^[a-f0-9]{24}$'),product_principal_id text NOT NULL CHECK(length(product_principal_id) BETWEEN 8 AND 128),created_at timestamptz NOT NULL DEFAULT now(),expires_at timestamptz NOT NULL,approved_subject text,approved_at timestamptz,redemption_hash char(64) UNIQUE,redeemed_at timestamptz,CHECK(expires_at<=created_at+interval '3 minutes'),CHECK((approved_subject IS NULL AND approved_at IS NULL) OR (approved_subject IS NOT NULL AND approved_at IS NOT NULL)),CHECK(redeemed_at IS NULL OR approved_at IS NOT NULL))",
 "CREATE TABLE IF NOT EXISTS rosie_identity_link.linked_seat(product_key text NOT NULL CHECK(product_key IN ('bob','directd','insureiq','settlementiq','emailiq')),organization_id text NOT NULL CHECK(organization_id ~ '^[a-f0-9]{24}$'),product_principal_id text NOT NULL,central_subject text NOT NULL CHECK(length(central_subject) BETWEEN 8 AND 128),issuer text NOT NULL CHECK(issuer='https://rosie-central-identity-staging.onrender.com/api/auth'),state text NOT NULL DEFAULT 'verified' CHECK(state IN ('verified','revoked')),verified_at timestamptz NOT NULL DEFAULT now(),revoked_at timestamptz,PRIMARY KEY(product_key,organization_id,product_principal_id),CHECK((state='verified' AND revoked_at IS NULL) OR state='revoked'))",
 "CREATE TABLE IF NOT EXISTS rosie_identity_link.mfa_stepup(session_id text PRIMARY KEY,user_id text NOT NULL,method text NOT NULL CHECK(method='totp'),proved_at timestamptz NOT NULL DEFAULT now(),expires_at timestamptz NOT NULL,CHECK(expires_at<=proved_at+interval '5 minutes'))",
 "CREATE TABLE IF NOT EXISTS rosie_identity_link.link_audit(event_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,product_key text,organization_id text,principal_hash char(64),subject_hash char(64),action text NOT NULL CHECK(action IN ('prepare','approve','redeem','replay','deny','revoke','stepup')),result text NOT NULL CHECK(result IN ('success','denied','error')),recorded_at timestamptz NOT NULL DEFAULT now())",
 "REVOKE ALL ON ALL TABLES IN SCHEMA rosie_identity_link FROM PUBLIC",
 "CREATE INDEX IF NOT EXISTS idx_rosie_link_subject ON rosie_identity_link.linked_seat(central_subject,product_key,state)",
 "CREATE INDEX IF NOT EXISTS idx_rosie_link_challenge_expiry ON rosie_identity_link.link_challenge(expires_at)"
 ];
 const client=await pool.connect();
 try{
  await client.query('BEGIN');
  for(const sql of statements)await client.query(sql);
  await client.query('COMMIT');
  return {tables:6,isolated:true};
 }catch(e){await client.query('ROLLBACK');throw e}
 finally{client.release()}
}
