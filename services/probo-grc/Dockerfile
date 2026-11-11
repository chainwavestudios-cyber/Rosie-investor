# Rosie Probo GRC staging — pinned upstream and TLS-verified PostgreSQL.
# Render blocks CAP_NET_BIND_SERVICE, which Probo does not need on port 8080.
FROM artifact.probo.inc/probo/probo:v0.340.0
USER root
RUN setcap -r /usr/local/bin/probod && setcap -r /usr/local/bin/probod-bootstrap || true
USER probo
EXPOSE 8080
# Probo's PostgreSQL client requires a CA bundle to enable certificate-verified
# TLS. Read the trusted system roots dynamically so no certificates/secrets live
# in the application repository.
ENTRYPOINT ["/bin/bash", "-c", "export PROBOD_PG_CA_CERT_BUNDLE=\"$(cat /etc/ssl/certs/ca-certificates.crt)\"; exec /usr/local/bin/entrypoint.sh"]
