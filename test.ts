import path from "node:path";

Bun.serve({
  port: 9999,
  cert: Bun.file(path.join(import.meta.dir, "test", "localhost.pem")),
  key: Bun.file(path.join(import.meta.dir, "test", "localhost-key.pem")),
  fetch() {
    return new Response("OK");
  },
});
