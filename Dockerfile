FROM oven/bun:1.3.5 AS base
LABEL org.opencontainers.image.source="https://github.com/navikt/modia-frontend"
LABEL org.opencontainers.image.description="BFF used in modia personoversikt"

WORKDIR /app

FROM base AS install
RUN mkdir -p /temp/prod


COPY package.json bun.lock bunfig.toml /temp/prod
RUN --mount=type=secret,id=node_auth_token \
  cd /temp/prod && \
  NODE_AUTH_TOKEN=$(cat /run/secrets/node_auth_token) bun install --frozen-lockfile --production

FROM oven/bun:1.3.5-distroless AS release

COPY --from=install /temp/prod/bunfig.toml ./
COPY --from=install /temp/prod/node_modules node_modules
COPY src src

ENV NODE_ENV=production

EXPOSE 3000/tcp
CMD ["./src/index.ts"]
