InsureIQ secure live-call media relay

STATUS: Code packaged; it has NOT been deployed or accepted for production. This is a transient WebSocket processing service, not a second CRM/database.

DEPLOYMENT
Deploy Node 20+ Web Service from services/insureiq-call-media-relay. Run npm install as build command, npm start as start command.

Environment variables needed ON RELAY:
INSUREIQ_RELAY_WSS = wss://YOUR-RELAY-DOMAIN/media
INSUREIQ_RELAY_SHARED_SECRET = unique 32-byte-or-longer random string, same exact value in Base44 app
DEEPGRAM_API_KEY = valid key for streaming STT
PORT = service-assigned port

Backend secrets needed IN BASE44 INSUREIQ:
INSUREIQ_RELAY_WSS = same exact public WSS URL, no query strings
INSUREIQ_RELAY_SHARED_SECRET = same shared secret as relay, never stored in source
(Deepgram per-agency AI provider entitlement/LLM access is separately required.)

GET /health must return HTTP 200 and ok=true before the interface allows call capture. Health alone does NOT prove the external provider works.

CONSENT AND SECURITY
The agent must obtain the required recording/transcription consent of every applicable party and explicitly confirm in the dialer. Base44 checks call ownership, assigned agent, live SID, subscription/development grant and relay health. Twilio Streams API starts unidirectional both_tracks WSS stream. Relay asks Base44 to verify the Twilio WebSocket signature against the selected organization Twilio auth token. No cross-tenant call may be processed.

The relay forwards raw mu-law 8000Hz data from each track to Deepgram separately. Final transcript segments are persisted under the organization and analyzed every 30 seconds. When the call ends, the relay requests final report generation. Audio frames are not intentionally stored by the relay. External providers process call audio; disclosures and data-processing agreements must reflect this.

LIVE ACCEPTANCE REQUIRED BEFORE ACTIVATION
1. Connect a dedicated internal test Twilio account; verify real account ownership, inbound/outbound routing and caller screen pop.
2. Perform a consented call with real agent and customer audio, verify both tracks and transcript segment continuity.
3. Verify live Q&A, coaching, objections, intent and Smart Listen every 30 seconds, and stored post-call report.
4. Reject invalid WebSocket signatures and account IDs, test cross-tenant requests, interrupted sessions, retries, no-answer and relay restart.
5. Reconcile Twilio and Deepgram invoices with provider usage; do not automatically charge credits yet.
6. Perform a third-party security, privacy, consent, retention and load review.

Do not set INSUREIQ_RELAY_WSS on Base44 until a valid, healthy, signed service deployment is actually running. The files in this folder are not themselves a running media relay.