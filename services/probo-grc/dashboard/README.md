# Probo-only compliance dashboard prototype

This is an **offline, read-only, static preview** of the draft control catalog. It is NOT installed in the upstream Probo application's dashboard, and is NOT deployed to the live Render service.

Serve `services/probo-grc/` as a static directory from the repository checkout, then open `/dashboard/`. The preview reads only `/controls/catalog.v1.json` from the same directory. It does not require credentials or connect to any APIs.

Example local command (from repo root):
```bash
cd services/probo-grc && python3 -m http.server 8765
```
Open `http://localhost:8765/dashboard/` in a browser.

To run tests, from repo root:
```bash
node --test services/probo-grc/controls/catalog.v1.test.mjs services/probo-grc/dashboard/dashboard.test.mjs services/probo-grc/rosie-evidence-v1.test.mjs
```
UI and design-system implementation remain owned by the PagePixels agent; this Probo-specific preview is a provisional workflow and acceptance mock, not a shared UI component.
