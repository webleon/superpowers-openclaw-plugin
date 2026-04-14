import assert from "node:assert/strict";
import test from "node:test";
import { getCachePaths, getGitStatus } from "../src/git-cache.ts";

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
