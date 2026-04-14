import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

export interface CachePaths {
  cacheDir: string;
  skillsDir: string;
}

export interface GitResult {
  success: boolean;
  message: string;
}

export interface GitStatus extends GitResult {
  loaded: boolean;
  repoUrl: string;
  commit?: string;
  date?: string;
}

export function getCachePaths(pluginDir: string): CachePaths {
  const cacheDir = join(pluginDir, ".superpowers-cache");
  return {
    cacheDir,
    skillsDir: join(cacheDir, "skills"),
  };
}

export function runGit(args: string[], cwd: string, timeout = 30000): GitResult {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    timeout,
  });

  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
  if (result.status === 0) {
    return { success: true, message: output || "OK" };
  }

  return {
    success: false,
    message: output || result.error?.message || `git ${args.join(" ")} failed`,
  };
}

export function ensureSkillsCache(pluginDir: string, repoUrl: string): GitResult & CachePaths {
  const paths = getCachePaths(pluginDir);
  if (existsSync(join(paths.cacheDir, ".git"))) {
    return { ...paths, success: true, message: "Skills already cached" };
  }

  mkdirSync(pluginDir, { recursive: true });
  const clone = runGit(["clone", "--depth", "1", repoUrl, paths.cacheDir], pluginDir, 60000);
  return { ...paths, ...clone };
}

export function updateSkillsCache(cacheDir: string): GitResult {
  if (!existsSync(join(cacheDir, ".git"))) {
    return { success: false, message: "Skills cache is not cloned" };
  }
  return runGit(["pull", "--ff-only"], cacheDir, 30000);
}

export function getGitStatus(cacheDir: string, repoUrl: string): GitStatus {
  if (!existsSync(join(cacheDir, ".git"))) {
    return { success: false, loaded: false, repoUrl, message: "Skills cache is not cloned" };
  }

  const commit = runGit(["rev-parse", "--short", "HEAD"], cacheDir, 5000);
  const date = runGit(["log", "-1", "--format=%cd"], cacheDir, 5000);
  if (!commit.success) {
    return { success: false, loaded: false, repoUrl, message: commit.message };
  }

  return {
    success: true,
    loaded: true,
    repoUrl,
    commit: commit.message,
    date: date.success ? date.message : undefined,
    message: `Skills cache at ${commit.message}`,
  };
}
