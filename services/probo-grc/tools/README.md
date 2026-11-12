# Synthetic Neon object storage acceptance helper

The script `storage-roundtrip.mjs` conducts an authenticated S3-style **PUT and GET** with two short-lived presigned Neon URLs; it compares SHA-256 on randomized **synthetic** content. It never records URLs, passwords or real evidence.

Steps for an authorized operator:
1. Pick a random object key under `acceptance/synthetic/` in the private Probo bucket.
2. Generate a short-lived **upload** presigned URL from Neon with content type `text/plain`, and a **download** presigned URL for the SAME key.
3. On a trusted shell, set `PROBO_TEST_PRESIGNED_PUT` and `PROBO_TEST_PRESIGNED_GET` as environment variables, and run `node services/probo-grc/tools/storage-roundtrip.mjs`.
4. Record only result, timestamp, synthetic object key, hash and reviewer. Never paste a signed URL into a ticket or log.
5. Remove the synthetic object using the scoped storage deletion tool after verification. Note that the script itself does not delete it.
6. Separately test via **Probo's native authenticated API**, logged-out rejection, cross-org isolation and retention. A passed presigned test alone is not Probo application acceptance.

Exit 2 means missing URLs; exit 1 means check failed; exit 0 means bytes matched. Network calls are constrained to HTTPS Neon storage hosts and reject redirects. No data leaves the Probo staging bucket.

CI runs ONLY the local negative tests with no URLs. No network or storage writes are performed by CI.
