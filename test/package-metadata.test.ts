import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const manifest = JSON.parse(readFileSync("openclaw.plugin.json", "utf8"));

test("package identity uses the owned npm package and repository", () => {
  assert.equal(packageJson.name, "superpowers-openclaw-plugin");
  assert.equal(packageJson.repository.url, "git+https://github.com/webleon/superpowers-openclaw-plugin.git");
  assert.deepEqual(packageJson.openclaw.extensions, ["./index.ts"]);
  assert.equal(packageJson.openclaw.install.npmSpec, "superpowers-openclaw-plugin");
});

test("manifest declares namespaced tools owned by this plugin", () => {
  assert.equal(manifest.id, "superpowers-openclaw-plugin");
  assert.equal(manifest.version, packageJson.version);
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

test("entrypoint uses definePluginEntry and namespaced tool registrations", () => {
  const entrypoint = readFileSync("index.ts", "utf8");
  assert.match(entrypoint, /definePluginEntry/);
  assert.match(entrypoint, /register\(api\)/);
  assert.match(entrypoint, /spSkill/);
  assert.match(entrypoint, /spUpdate/);
  assert.match(entrypoint, /spStatus/);
  assert.doesNotMatch(entrypoint, /update_superpowers_skills/);
  assert.doesNotMatch(entrypoint, /superpowers_version/);
});

test("readme documents owned install paths and sp tools", () => {
  const readme = readFileSync("README.md", "utf8");
  assert.match(readme, /superpowers-openclaw-plugin/);
  assert.match(readme, /plugins\.entries\.superpowers-openclaw-plugin/);
  assert.match(readme, /webleon\/superpowers-openclaw-plugin/);
  assert.match(readme, /sp_skill/);
  assert.match(readme, /sp_update/);
  assert.match(readme, /sp_status/);
  assert.doesNotMatch(readme, /@vruru\/superpowers-bridge/);
});

test("runtime source avoids shell execution patterns blocked by OpenClaw install", () => {
  const files = collectFiles(["index.ts", "src"]);
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    assert.doesNotMatch(source, /node:child_process|child_process|spawnSync|execSync/);
  }
});

function collectFiles(paths: string[]): string[] {
  const files: string[] = [];
  for (const current of paths) {
    const stat = statSync(current);
    if (stat.isFile()) {
      files.push(current);
      continue;
    }
    for (const entry of readdirSync(current)) {
      files.push(...collectFiles([join(current, entry)]));
    }
  }
  return files.filter((file) => file.endsWith(".ts"));
}
