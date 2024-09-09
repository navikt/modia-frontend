from oven/bun:1.1.27 as base
LABEL org.opencontainers.image.source="https://github.com/navikt/modia-frontend"
LABEL org.opencontainers.image.description="BFF used in modia personoversikt"

WORKDIR /app

FROM base as install
RUN mkdir -p /temp/prod


COPY package.json bun.lockb bunfig.toml /temp/prod
RUN --mount=type=secret,id=bun_auth_token \
  cd /temp/prod && \
  BUN_AUTH_TOKEN=$(cat /run/secrets/bun_auth_token) bun install --frozen-lockfile --production

FROM base as release
COPY --from=install /temp/prod/node_modules node_modules
COPY src src
COPY entrypoint.sh ./

ENV NODE_ENV=production

EXPOSE 3000/tcp
ENTRYPOINT ["./entrypoint.sh"]
CMD ["src/index.ts"]
