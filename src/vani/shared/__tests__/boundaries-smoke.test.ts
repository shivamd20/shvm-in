import { describe, expect, it } from "vitest";
import { ESLint } from "eslint";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs/promises";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");

async function listFixtureFiles(dir: string) {
  const absoluteDir = path.join(repoRoot, dir);
  const entries = await fs.readdir(absoluteDir);
  return entries
    .filter((name) => name.endsWith(".ts") || name.endsWith(".tsx"))
    .map((name) => path.join(absoluteDir, name));
}

describe("vani boundaries (smoke)", () => {
  it("fails lint on boundary violations in fixtures", async () => {
    const fixtureDirs = [
      "src/vani/shared/__boundary_fixtures__",
      "src/vani/headless/__boundary_fixtures__",
      "src/vani/ui/__boundary_fixtures__",
      "src/vani/server/__boundary_fixtures__",
    ];

    const files = (await Promise.all(fixtureDirs.map(listFixtureFiles))).flat();
    expect(files.length).toBeGreaterThan(0);

    const eslint = new ESLint({
      cwd: repoRoot,
      overrideConfigFile: path.join(repoRoot, "eslint.boundary-smoke.config.js"),
    });
    const results = await eslint.lintFiles(files);

    const byFile = new Map(results.map((r) => [path.normalize(r.filePath), r]));
    for (const file of files) {
      const result = byFile.get(path.normalize(file));
      expect(result, `Missing eslint result for ${file}`).toBeTruthy();
      const hasBoundaryError = (result?.messages ?? []).some((m) => m.ruleId === "boundaries/element-types");
      expect(hasBoundaryError, `Expected boundaries/element-types error for ${file}`).toBe(true);
    }
  });
});
