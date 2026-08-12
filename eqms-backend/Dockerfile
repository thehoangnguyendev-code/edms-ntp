# syntax=docker/dockerfile:1.7
# Keep the builder image configurable so compose can use the local/registry
# mirror. The default avoids Docker Hub in environments where it is slow or
# blocked, while BACKEND_BUILD_IMAGE can still override it explicitly.
ARG MAVEN_IMAGE=mirror.gcr.io/library/maven:3.9.16-eclipse-temurin-21
FROM ${MAVEN_IMAGE} AS build

WORKDIR /workspace

COPY pom.xml .
RUN mvn -q -DskipTests dependency:go-offline

COPY src ./src
RUN mvn -q -DskipTests clean package

FROM eclipse-temurin:21-jre-jammy

ENV TZ=Asia/Ho_Chi_Minh

RUN apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl \
        fontconfig \
        fonts-dejavu-core \
        tzdata \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN groupadd --system eqms \
    && useradd --system --gid eqms --home-dir /app --shell /usr/sbin/nologin eqms \
    && mkdir -p /app/storage/revisions /app/logs \
    && chown -R eqms:eqms /app

COPY --from=build --chown=eqms:eqms /workspace/target/eqms-backend-*.jar /app/eqms-backend.jar

USER eqms

EXPOSE 5000

ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75.0", "-Djava.io.tmpdir=/tmp", "-jar", "/app/eqms-backend.jar"]
