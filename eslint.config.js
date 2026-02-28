import boundaries from "eslint-plugin-boundaries";
import tseslint from "typescript-eslint";

export default [
  {
    ignores: ["dist/**", "node_modules/**", "packages/vani-client/**", "**/*.config.{ts,js,mjs}"],
  },
  {
    files: ["src/vani/**/*.{ts,tsx}"],
    ignores: ["src/vani/**/__boundary_fixtures__/**"],
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
            { from: "public", allow: ["public", "server"] },
            { from: "server", allow: ["server"] },
          ],
        },
      ],
    },
  },
  {
    files: ["src/vani/server/**/*.{ts,tsx}"],
    ignores: ["src/vani/**/__boundary_fixtures__/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@shvm/vani-client",
              message: "Server must not import headless runtime; use @shvm/vani-client/shared only.",
            },
          ],
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
