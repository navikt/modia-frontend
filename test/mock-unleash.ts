import { mock } from "bun:test";

class MockUnleash {
  isEnabled(toggleId: string) {
    return toggleId === "test-toggle";
  }

  on() {}
}

process.env.UNLEASH_SERVER_API_URL = "noop";

await mock.module("unleash-client", () => ({
  Unleash: MockUnleash,
}));
