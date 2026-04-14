import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const manifest = JSON.parse(readFileSync("openclaw.plugin.json", "utf8"));

test("package identity uses the owned npm package and repository", () => {
  assert.equal(packageJson.name, "openclaw-superpowers-plugin");
  assert.equal(packageJson.repository.url, "https://github.com/webleon/superpowers-openclaw-plugin");
  assert.deepEqual(packageJson.openclaw.extensions, ["./index.ts"]);
  assert.equal(packageJson.openclaw.install.npmSpec, "openclaw-superpowers-plugin");
});

test("manifest declares namespaced tools owned by this plugin", () => {
  assert.equal(manifest.id, "openclaw-superpowers-plugin");
  assert.deepEqual(manifest.contracts.tools, ["sp_skill", "sp_update", "sp_status"]);
});

test("manifest exposes only the packaged bridge skill", () => {
  assert.deepEqual(manifest.skills, ["skills/openclaw-superpowers/SKILL.md"]);
  assert.equal(existsSync("skills/openclaw-superpowers/SKILL.md"), true);
});

test("manifest config schema omits duplicate enabled toggle", () => {
  assert.equal(manifest.configSchema.properties.enabled, undefined);
  assert.equal(manifest.configSchema.additionalProperties, false);
});
