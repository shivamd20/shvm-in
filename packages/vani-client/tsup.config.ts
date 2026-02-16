import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "shared/index": "src/shared/index.ts",
    "headless/index": "src/headless/index.ts",
  },
  format: ["esm"],
  target: "es2022",
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  splitting: false,
  external: ["react", "xstate", "@xstate/react", "@ricky0123/vad-react", "onnxruntime-web"],
});

