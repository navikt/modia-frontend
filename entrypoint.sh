#!/bin/bash

run_args=()

otel_preload() {
  if [ -n "${OTEL_EXPORTER_OTLP_ENDPOINT+x}" ]; then
    run_args+=("--preload src/instrumentation.ts")
  fi
}

otel_preload

bun run "${run_args[@]}" "$@"
