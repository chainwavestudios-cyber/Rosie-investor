# BOB activation on the existing Rosie Render service

## Confirmed endpoints (2026-11-04)

| Endpoint | Live response | Meaning |
| --- | --- | --- |
| `https://ai-agent-6xc1.onrender.com/health` | **200** | Existing audio server reachable |
| `https://ai-agent-6xc1.onrender.com/runtime` | **401** without authentication | Protected Fronter runtime responds |
| `https://ai-agent-6xc1.onrender.com/bob/runtime` | **404** | Running Render image **does not yet contain the isolated BOB route** |
| `https://bob-training-intelligence-8019bf2b.base44.app/functions/bobMediaRelay` | **401** without authentication | Standalone BOB backend callback deployed and protected |

The Base44 BOB app was configured with `BOB_ENVIRONMENT=staging` and `BOB_STAGING_WS_URL=wss://ai-agent-6xc1.onrender.com/bob/ws`. This registers the correct **target** but does not mean it is usable until the updated image is deployed and provisioned.

## Render environment — same existing service, different credentials

Existing Fronter `/ws` settings, `APP_WEBHOOK_URL`, `APP_AUTH_TOKEN`, `PLAY_AUTH_TOKEN`, `STREAM_AUTH_TOKEN` and provider API keys **must remain unchanged**.

Add the following to the existing `ai-agent-6xc1` service, not to a new unrelated instance:

| Render key | Value or matching Base44 setting |
| --- | --- |
| `BOB_ALLOWED_ORIGINS` | `https://bob-training-intelligence-8019bf2b.base44.app` |
| `BOB_APP_WEBHOOK_URL` | `https://bob-training-intelligence-8019bf2b.base44.app/functions/bobMediaRelay` |
| `BOB_BRIDGE_SESSION_SECRET` | Must match Base44 `BOB_BRIDGE_SESSION_SECRET`; minimum 32 characters |
| `BOB_APP_AUTH_TOKEN` | Must match Base44 `BOB_BRIDGE_APP_AUTH_TOKEN`; minimum 24 characters |
| `BOB_PLAY_AUTH_TOKEN` | Must match Base44 `BOB_BRIDGE_PLAY_AUTH_TOKEN`; minimum 24 characters |
| `BOB_BRIDGE_ENABLED` | `false` during initial deploy; enable only after authenticating `/bob/runtime` and checking callback isolation |
| `DEEPGRAM_API_KEY` | Existing provider key must be verified **on Render**; never place it in this public repository |
| `CARTESIA_API_KEY` | Existing provider key must be verified **on Render** for Jacked Up BOB |

Base44 masks all stored secret values; presence of a secret **cannot** establish that it matches Render. Never overwrite one side alone during credential synchronization. For any new values, write the **same securely generated value to both sides in one coordinated operation**, then verify each side's status; do not expose values in tickets, logs or screenshots.

## Deployment acceptance

1. **Before deploying:** Review draft PR #1; inspect the live Render build/image source. `render.yaml` contains a placeholder image reference, so GitHub passing CI does not automatically update the running service. Back up the existing image tag and Render configuration.
2. Build and deploy the reviewed combined image with BOB disabled. Verify Fronter `/health`, `/runtime`, and a representative existing Fronter inbound/outbound call before activating BOB.
3. Verify the isolated `/bob/runtime` now returns **401 without its own token** (route exists), not the current 404. This check exposes no credentials.
4. Synchronize the three BOB secrets on both services, preserving Fronter secrets. Verify authenticated `/bob/runtime` reports `ready:true` with Deepgram provider configured.
5. Enable `BOB_BRIDGE_ENABLED=true` in Render; verify the BOB admin diagnostics panel under **AI Usage & Costs**, then run a real Plain BOB browser call followed by Jacked Up BOB.
6. Test negative authorization (invalid/mismatched org ticket, wrong Origin, runtime token separation), transcript and interrupt/reconnect behavior, live tools, BOB callback receipts and an existing Fronter call in parallel.
7. Do **not** enable Rosie Core/Neon financial debits or credit packs on the strength of transport tests alone.

## Boundaries

- No live Render environment or container deployment was modified by adding these instructions.
- GitHub Actions validates source + candidate Docker image; it does **not** confirm Render runtime configuration.
- Direct browser access to the Deepgram master key remains disabled.
