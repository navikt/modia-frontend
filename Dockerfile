from oven/bun:1 as base
LABEL org.opencontainers.image.source="https://github.com/navikt/modia-frontend"
LABEL org.opencontainers.image.description="BFF used in modia personoversikt"

WORKDIR /app

FROM base as install
RUN mkdir -p /temp/prod

COPY package.json bun.lockb /temp/prod
RUN cd /temp/prod && bun install --frozen-lockfile --production

FROM base as release
COPY --from=install /temp/prod/node_modules node_modules
COPY . .

ENV NODE_ENV=production

EXPOSE 3000/tcp
ENTRYPOINT ["bun", "run", "src/index.ts"]
