import { GlobalRegistrator } from "@happy-dom/global-registrator";

// A DOM for component tests. Run through `bun run test`, which
// is its own process, so these globals never leak outside the test run.
if (!globalThis.document) GlobalRegistrator.register({ url: "http://localhost/" });
