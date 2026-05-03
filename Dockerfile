# careplus — production Docker image (staging on Render free tier for now).
# Three stages so the final image ships only the runtime + jar, not the whole toolchain.
#
# ADR-020: single process, Spring Boot serves the Vite bundle from /static.
# ADR-022: Render + Neon for free staging, upgrade to paid same platform later.

# ── Stage 1: build the Vite frontend ─────────────────────────────────────
FROM node:22-alpine AS frontend-build

WORKDIR /app/frontend

# Copy only package manifests first so npm ci is cached when source changes
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund --prefer-offline

# Copy source + build. The prod build outputs to frontend/dist/.
COPY frontend/ ./
RUN npm run build

# ── Stage 2: build the Spring Boot fat jar ───────────────────────────────
FROM maven:3.9-eclipse-temurin-21 AS backend-build

WORKDIR /build

# Maven deps cache layer (only reinvalidates when pom.xml changes)
COPY pom.xml .
COPY .mvn/ ./.mvn/
RUN mvn -B -q dependency:go-offline -DskipTests

# Bring the frontend bundle into Spring's static classpath BEFORE package
# so the jar ships with the SPA baked in (no separate static server needed).
COPY src/ ./src/
COPY --from=frontend-build /app/frontend/dist/ ./src/main/resources/static/

# Skip tests here — the GitHub Actions CI job is the quality gate. The Docker
# build is only about producing a shippable artifact.
RUN mvn -B -q -DskipTests clean package \
 && cp target/*.jar /app.jar

# ── Stage 3: minimal runtime (distroless, nonroot, no shell) ─────────────
FROM gcr.io/distroless/java21-debian12:nonroot AS runtime

WORKDIR /app

# Copy the fat jar only. No Maven, no Node, no shell. Tiny attack surface.
COPY --from=backend-build /app.jar app.jar

# Render's free tier gives ~512MB RAM; 75% of that = ~384MB heap.
# SerialGC is cheaper than G1 on a single shared vCPU.
# ExitOnOutOfMemoryError makes the container die fast so Render restarts it
# instead of serving degraded responses.
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75 -XX:+UseSerialGC -XX:+ExitOnOutOfMemoryError -Duser.timezone=Africa/Casablanca"

# Spring profile for cloud deployments (reads DATABASE_URL / DATABASE_USER /
# DATABASE_PASSWORD env vars — set these in Render's dashboard).
ENV SPRING_PROFILES_ACTIVE=prod-cloud

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "/app/app.jar"]
