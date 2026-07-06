import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  format: "esm",
  outDir: "dist",
  // Workspace packages export raw .ts sources, which plain `node` cannot
  // load from node_modules in production — bundle them into the artifact.
  noExternal: [/^@buy-crypto-dip-bot\//],
});
