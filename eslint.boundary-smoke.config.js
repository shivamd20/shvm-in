import boundaries from "eslint-plugin-boundaries";
import tseslint from "typescript-eslint";

export default [
  {
    files: ["src/vani/**/__boundary_fixtures__/**/*.{ts,tsx}"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      boundaries,
    },
    settings: {
      "import/resolver": {
        typescript: {
          project: "./tsconfig.json",
        },
      },
      "boundaries/include": ["src/vani/**/*"],
      "boundaries/elements": [
        { type: "public", pattern: "src/vani/index.ts" },
        { type: "shared", pattern: "src/vani/shared/**" },
        { type: "headless", pattern: "src/vani/headless/**" },
        { type: "ui", pattern: "src/vani/ui/**" },
        { type: "server", pattern: "src/vani/server/**" },
      ],
    },
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["../*", "../**"],
              message: "Do not use parent relative imports inside src/vani/*; use @vani/* aliases.",
            },
          ],
        },
      ],
      "boundaries/element-types": [
        "error",
        {
          default: "disallow",
          rules: [
            { from: "public", allow: ["public", "shared", "headless", "ui", "server"] },
            { from: "shared", allow: ["shared"] },
            { from: "headless", allow: ["headless", "shared"] },
            { from: "ui", allow: ["ui", "headless", "shared"] },
            { from: "server", allow: ["server", "shared"] },
          ],
        },
      ],
    },
  },
];
