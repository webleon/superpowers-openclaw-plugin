import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { ensureSkillsCache, getCachePaths, getGitStatus } from "../src/git-cache.ts";

test("getCachePaths keeps upstream skills under a plugin-local cache directory", () => {
  const paths = getCachePaths("/plugins/superpowers-openclaw-plugin");
  assert.equal(paths.cacheDir, "/plugins/superpowers-openclaw-plugin/.superpowers-cache");
  assert.equal(paths.skillsDir, "/plugins/superpowers-openclaw-plugin/.superpowers-cache/skills");
});

test("getGitStatus reports unavailable cache when cache metadata is missing", () => {
  const result = getGitStatus("/path/that/does/not/exist", "https://github.com/obra/superpowers.git");
  assert.equal(result.success, false);
  assert.equal(result.repoUrl, "https://github.com/obra/superpowers.git");
  assert.equal(result.loaded, false);
});

test("getGitStatus tolerates sync lock directories without metadata", () => {
  const cacheDir = mkdtempSync("/tmp/sp-cache-test-");
  mkdirSync(join(cacheDir, ".sync-lock"));
  const result = getGitStatus(cacheDir, "https://github.com/obra/superpowers.git");
  assert.equal(result.success, false);
  assert.equal(result.loaded, false);
  rmSync(cacheDir, { recursive: true, force: true });
});

test("ensureSkillsCache returns existing cache even when a sync lock directory remains", async () => {
  const pluginDir = mkdtempSync("/tmp/sp-plugin-test-");
  const paths = getCachePaths(pluginDir);
  mkdirSync(paths.skillsDir, { recursive: true });
  mkdirSync(join(paths.cacheDir, ".sync-lock"));
  writeFileSync(join(paths.cacheDir, "superpowers-cache.json"), JSON.stringify({
    repoUrl: "https://github.com/obra/superpowers.git",
    commit: "917e5f53b16b115b70a3a355ed5f4993b9f8b73d",
    date: "2026-04-06T22:48:58Z",
  }), "utf8");

  const result = await ensureSkillsCache(pluginDir, "https://github.com/obra/superpowers.git");
  assert.equal(result.success, true);
  assert.match(result.message, /Skills already cached/);

  rmSync(pluginDir, { recursive: true, force: true });
});
