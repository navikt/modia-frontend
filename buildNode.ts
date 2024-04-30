const res = await Bun.build({
  entrypoints: ["src/index.ts"],
  target: "node",
  outdir: "./build",
  define: {
    BUNDLE_FOR_NODE: "true",
  },
  minify: {
    syntax: true,
  },
});

if (!res.success) {
  throw new AggregateError(res.logs, "Build failed");
}
for (const message of res.logs) {
  console.log(message);
}
