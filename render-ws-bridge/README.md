# Rosie WS Bridge

Twilio Media Streams WebSocket audio transport for Render. **Phase 1 = transport only.** AI / Deepgram logic stays in the Base44 app; this container just relays audio and events.

## What it does
- Accepts Twilio Media Streams at `wss://<your-service>.onrender.com/ws`
- Batches inbound audio and POSTs it to your app (`APP_WEBHOOK_URL`)
- Exposes `POST /play` so the app can push TTS audio back into the call
- Health check at `GET /health`, keepalive pings, graceful shutdown

## Build & publish the image
```bash
docker build -t rosie-ws-bridge:latest .
# tag for your registry (Docker Hub or GHCR)
docker tag rosie-ws-bridge:latest <your-registry>/rosie-ws-bridge:latest
docker push <your-registry>/rosie-ws-bridge:latest
```

## Deploy on Render
1. New → Web Service → **Existing Image** → paste `<your-registry>/rosie-ws-bridge:latest`
2. Set env vars (below). Render auto-detects the port from `PORT`.
3. Health check path: `/health`

## Environment variables
| Var | Default | Required | Purpose |
|---|---|---|---|
| `PORT` | `10000` | no | Listen port |
| `WS_PATH` | `/ws` | no | WebSocket path |
| `APP_WEBHOOK_URL` | — | yes | Base44 function URL receiving audio batches |
| `APP_AUTH_TOKEN` | — | no | Bearer token sent to `APP_WEBHOOK_URL` |
| `STREAM_AUTH_TOKEN` | — | no | Validated against `start.customParameters.streamToken` before audio is accepted |
| `AUDIO_BATCH_MS` | `250` | no | Inbound audio flush cadence |
| `PING_INTERVAL_MS` | `30000` | no | Keepalive ping cadence |
| `LOG_LEVEL` | `info` | no | `info` / `debug` / `silent` |

## Twilio Media Streams wiring
In your Twilio TwiML, point `<Connect><Stream>` at the Render wss URL:
```xml
<Connect>
  <Stream url="wss://<your-service>.onrender.com/ws">
    <Parameter name="leadId" value="YOUR_LEAD_ID" />
    <Parameter name="streamToken" value="YOUR_STREAM_AUTH_TOKEN" />
  </Stream>
</Connect>
```
Twilio does not support query strings in the Stream URL. Send the stream credential as a nested Parameter instead. The bridge upgrades the connection, then validates Twilio's nested `start.customParameters.streamToken` before relaying anything. Invalid or missing credentials close the socket with code 1008; a connection without a start message closes after five seconds.

Build the container from the root `render-ws-bridge/` directory: its Dockerfile packages `render-ws-bridge/server.js`, not `src/render-ws-bridge/server.js`. After changing the bridge, rebuild and push the container image, then redeploy the Render service using that new image; restarting the existing image does not include source changes. Confirm the authenticated `/runtime` response includes `diagnosticsVersion: "tts-diagnostics-v2"` before making a new test call. TTS fallback evidence retains the original ElevenLabs HTTP status, redacted response body, selected model and voice under `tts.failure`, and a readable explanation under `tts.error`. The pipeline protocol remains `selector-runtime-v1`.

If the app's voice handler changes, publish that too. Both sides must use this parameter-based contract before making another call.

## App-side contract (Base44 function)
Create a function (e.g. `mediaStreamRelay`) that accepts the batch JSON:
- `{event:"start", streamSid, callSid, tracks, customParameters}`
- `{event:"media_batch", streamSid, callSid, media:[{track,chunk,timestamp,payload}]}`
- `{event:"stop", streamSid, callSid}`

To play audio back, the function calls the container:
```
POST https://<your-service>.onrender.com/play
{ "streamSid": "...", "payload": "<base64 mulaw>" }
```
Optionally, the function may return `{play, streamSid}` inline in its response and the bridge will play it immediately.

## Turning on in-container AI later
The relay seams are `forwardToApp()` (inbound) and `sendToTwilio()` (outbound). Swap the HTTP forward for in-process Deepgram + LLM, and reuse `sendToTwilio()` for TTS — no transport interface changes needed.

## Commercial BOB browser route — November 15, 2026

`/bob/ws` is a separately authenticated browser-training route. Its session
ticket selects either Plain BOB's existing Deepgram managed voice agent or the
Jacked Up BOB pipeline (Deepgram Flux STT → BOB-signed Core Haiku 4.5 →
Rosie Core master Cartesia Sonic 3.6/Skylar TTS).

For **Jacked Up BOB browser sessions only**, `streamCartesiaTTS` now sends
a bounded `event: "tts"` to the private BOB `bobMediaRelay` callback,
which authenticates the session and signs the exact speech request to
`coreBobPilotTts` in Rosie Core. Core returns metered, 8 kHz raw μ-law audio
for the selected Skylar voice; the bridge streams those bytes to the browser.
No Render-local Cartesia master key is required by the BOB browser route.
The operation is currently restricted to the approved internal executive
pilot and does not debit any customer credit wallet.

A failed Core/Claude turn is sent back as an explicit `bob_error` for the
browser instead of leaving the user in an unresponsive call. If Core Skylar
synthesis fails, the BOB route displays an error instead of silently playing
Deepgram Aura and presenting it as Skylar.

**Do not change the existing Fronter `/ws`, investor callbacks, Twilio
credentials, or the distinct InsureIQ BOB route.** The conditions above
apply only to `session.browser === true` in commercial BOB's
`/bob/ws` transport. The Base44 BOB relay and Core functions must be
deployed before the Render bridge revision.
