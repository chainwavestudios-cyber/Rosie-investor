# Rosie Probo GRC staging. Pin to tested upstream release.
# Render runs an unprivileged container and blocks execution of a binary carrying
# CAP_NET_BIND_SERVICE; Probo listens on unprivileged port 8080 here.
FROM artifact.probo.inc/probo/probo:v0.340.0
USER root
RUN setcap -r /usr/local/bin/probod && setcap -r /usr/local/bin/probod-bootstrap || true
USER probo
EXPOSE 8080
