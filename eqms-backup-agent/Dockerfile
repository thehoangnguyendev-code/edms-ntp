# syntax=docker/dockerfile:1.7
# Backup Agent image. Same build pattern as the backend: a configurable Maven image, then a small runtime.
ARG MAVEN_IMAGE=mirror.gcr.io/library/maven:3.9.16-eclipse-temurin-21
FROM ${MAVEN_IMAGE} AS build

WORKDIR /workspace
COPY pom.xml .
RUN mvn -q -DskipTests dependency:go-offline

COPY src ./src
RUN mvn -q -DskipTests clean package

FROM eclipse-temurin:21-jre-alpine

# pg_dump must match the server's major version (17). gnupg encrypts; the agent holds only the public key.
RUN apk add --no-cache postgresql17-client gnupg curl tzdata \
    && addgroup -S agent && adduser -S -G agent -h /home/agent -s /sbin/nologin -u 10001 agent \
    && mkdir -p /backup/t1 /backup/ledger /backup/agent /tmp/agent-gnupg \
    && chown -R agent:agent /backup /tmp/agent-gnupg /home/agent

WORKDIR /app
COPY --from=build --chown=agent:agent /workspace/target/eqms-backup-agent-*.jar /app/eqms-backup-agent.jar

USER agent
ENV TZ=Asia/Ho_Chi_Minh
EXPOSE 5600

ENTRYPOINT ["java", "-XX:MaxRAMPercentage=60.0", "-Djava.io.tmpdir=/tmp", "-jar", "/app/eqms-backup-agent.jar"]
