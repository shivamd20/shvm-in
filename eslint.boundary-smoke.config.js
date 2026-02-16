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
              message:
                "Do not use parent relative imports inside src/vani/*; use @vani/* aliases (ui/server) or @shvm/vani-client/* (headless/shared).",
            },
          ],
        },
      ],
      "boundaries/element-types": [
        "error",
        {
          default: "disallow",
          rules: [
            { from: "public", allow: ["public", "ui", "server"] },
            { from: "ui", allow: ["ui"] },
            { from: "server", allow: ["server"] },
          ],
        },
      ],
    },
  },
  {
    files: ["src/vani/server/**/__boundary_fixtures__/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@shvm/vani-client/headless", "@shvm/vani-client/headless/*"],
              message: "Server must not import headless runtime; use @shvm/vani-client/shared only.",
            },
          ],
        },
      ],
    },
  },
];
