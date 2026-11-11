# Rosie Probo GRC staging — pinned upstream release.
# Probo enables certificate-verified Neon TLS when PROBOD_PG_CA_BUNDLE_PATH
# points at the container's system CA store (configured in Render).
FROM artifact.probo.inc/probo/probo:v0.340.0
USER root
RUN setcap -r /usr/local/bin/probod && setcap -r /usr/local/bin/probod-bootstrap || true
USER probo
EXPOSE 8080
