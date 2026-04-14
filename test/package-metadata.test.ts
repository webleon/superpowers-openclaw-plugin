import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));

test("package identity uses the owned npm package and repository", () => {
  assert.equal(packageJson.name, "openclaw-superpowers-plugin");
  assert.equal(packageJson.repository.url, "https://github.com/webleon/superpowers-openclaw-plugin");
  assert.deepEqual(packageJson.openclaw.extensions, ["./index.ts"]);
  assert.equal(packageJson.openclaw.install.npmSpec, "openclaw-superpowers-plugin");
});
