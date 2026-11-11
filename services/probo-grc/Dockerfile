# Rosie Probo GRC staging — pinned upstream container and TLS-verified Neon.
FROM artifact.probo.inc/probo/probo:v0.340.0
USER root
RUN setcap -r /usr/local/bin/probod && setcap -r /usr/local/bin/probod-bootstrap || true
USER probo
EXPOSE 8080
# Probo only enables pg TLS when a PEM CA bundle is configured. Limit
# certificates to trusted roots to stay below Linux MAX_ARG_STRLEN.
ENTRYPOINT ["/bin/bash", "-c", "set -e; export PROBOD_PG_CA_CERT_BUNDLE=\"$(cat /etc/ssl/certs/Amazon_Root_CA_1.pem /etc/ssl/certs/ISRG_Root_X1.pem /etc/ssl/certs/DigiCert_Global_Root_G2.pem)\"; exec /usr/local/bin/entrypoint.sh"]
