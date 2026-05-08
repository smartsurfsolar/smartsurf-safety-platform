FROM traccar/traccar:6.13.3

LABEL org.opencontainers.image.title="SmartSurf Safety Platform"
LABEL org.opencontainers.image.description="SmartSurf-branded Traccar platform with watersports safety UI."

COPY traccar-web/build/ /opt/traccar/web/
