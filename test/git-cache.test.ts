import assert from "node:assert/strict";
import test from "node:test";
import { getCachePaths, getGitStatus, runGit } from "../src/git-cache.ts";

test("getCachePaths keeps upstream skills under a plugin-local cache directory", () => {
  const paths = getCachePaths("/plugins/openclaw-superpowers-plugin");
  assert.equal(paths.cacheDir, "/plugins/openclaw-superpowers-plugin/.superpowers-cache");
  assert.equal(paths.skillsDir, "/plugins/openclaw-superpowers-plugin/.superpowers-cache/skills");
});

test("runGit returns failure details without throwing", () => {
  const result = runGit(["not-a-real-git-command"], process.cwd(), 1000);
  assert.equal(result.success, false);
  assert.match(result.message, /not-a-real-git-command|git/);
});

test("getGitStatus reports unavailable cache when .git is missing", () => {
  const result = getGitStatus("/path/that/does/not/exist", "https://github.com/obra/superpowers.git");
  assert.equal(result.success, false);
  assert.equal(result.repoUrl, "https://github.com/obra/superpowers.git");
  assert.equal(result.loaded, false);
});
