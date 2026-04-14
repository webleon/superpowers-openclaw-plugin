import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import * as fs from "node:fs";
import { dirname, join } from "node:path";

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

interface CacheMetadata {
  repoUrl: string;
  commit: string;
  date?: string;
}

interface GitHubRepo {
  owner: string;
  repo: string;
  branch: string;
}

const METADATA_FILE = "superpowers-cache.json";

export function getCachePaths(pluginDir: string): CachePaths {
  const cacheDir = join(pluginDir, ".superpowers-cache");
  return {
    cacheDir,
    skillsDir: join(cacheDir, "skills"),
  };
}

export async function ensureSkillsCache(pluginDir: string, repoUrl: string): Promise<GitResult & CachePaths> {
  const paths = getCachePaths(pluginDir);
  if (existsSync(join(paths.cacheDir, METADATA_FILE)) && existsSync(paths.skillsDir)) {
    return { ...paths, success: true, message: "Skills already cached" };
  }

  const result = await syncSkillsCache(paths.cacheDir, repoUrl);
  return { ...paths, ...result };
}

export async function updateSkillsCache(cacheDir: string, repoUrl: string): Promise<GitResult> {
  return syncSkillsCache(cacheDir, repoUrl);
}

export function getGitStatus(cacheDir: string, repoUrl: string): GitStatus {
  const metadataPath = join(cacheDir, METADATA_FILE);
  if (!existsSync(metadataPath)) {
    return { success: false, loaded: false, repoUrl, message: "Skills cache is not synced" };
  }

  try {
    const metadata = JSON.parse(readFileSync(metadataPath, "utf8")) as CacheMetadata;
    const shortCommit = metadata.commit.slice(0, 7);
    return {
      success: true,
      loaded: true,
      repoUrl: metadata.repoUrl,
      commit: shortCommit,
      date: metadata.date,
      message: `Skills cache at ${shortCommit}`,
    };
  } catch (error) {
    return { success: false, loaded: false, repoUrl, message: errorMessage(error) };
  }
}

async function syncSkillsCache(cacheDir: string, repoUrl: string): Promise<GitResult> {
  const repo = parseGitHubRepo(repoUrl);
  if (!repo) {
    return { success: false, message: `Only GitHub repo URLs are supported for safe sync: ${repoUrl}` };
  }

  try {
    const commit = await fetchJson<{
      sha: string;
      commit: { committer?: { date?: string }; author?: { date?: string } };
    }>(`https://api.github.com/repos/${repo.owner}/${repo.repo}/commits/${repo.branch}`);
    const tree = await fetchJson<{
      tree: Array<{ path: string; type: string; url: string }>;
    }>(`https://api.github.com/repos/${repo.owner}/${repo.repo}/git/trees/${commit.sha}?recursive=1`);

    const skillFiles = tree.tree.filter((entry) => entry.type === "blob" && entry.path.startsWith("skills/"));
    const nextSkillsDir = join(cacheDir, "skills.next");
    const skillsDir = join(cacheDir, "skills");

    rmSync(nextSkillsDir, { recursive: true, force: true });
    mkdirSync(nextSkillsDir, { recursive: true });

    for (const entry of skillFiles) {
      const target = join(nextSkillsDir, entry.path.slice("skills/".length));
      mkdirSync(dirname(target), { recursive: true });
      const source = `https://raw.githubusercontent.com/${repo.owner}/${repo.repo}/${commit.sha}/${entry.path}`;
      writeFileSync(target, await fetchText(source), "utf8");
    }

    rmSync(skillsDir, { recursive: true, force: true });
    fs.renameSync(nextSkillsDir, skillsDir);
    writeFileSync(join(cacheDir, METADATA_FILE), JSON.stringify({
      repoUrl,
      commit: commit.sha,
      date: commit.commit.committer?.date ?? commit.commit.author?.date,
    } satisfies CacheMetadata, null, 2), "utf8");

    return { success: true, message: `Skills synced at ${commit.sha.slice(0, 7)} (${skillFiles.length} files)` };
  } catch (error) {
    return { success: false, message: errorMessage(error) };
  }
}

function parseGitHubRepo(repoUrl: string): GitHubRepo | null {
  const https = repoUrl.match(/^https:\/\/github\.com\/([^/]+)\/([^/.]+)(?:\.git)?$/);
  if (https) return { owner: https[1], repo: https[2], branch: "main" };

  const ssh = repoUrl.match(/^git@github\.com:([^/]+)\/([^/.]+)(?:\.git)?$/);
  if (ssh) return { owner: ssh[1], repo: ssh[2], branch: "main" };

  return null;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: { "User-Agent": "superpowers-openclaw-plugin" } });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return response.json() as Promise<T>;
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, { headers: { "User-Agent": "superpowers-openclaw-plugin" } });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return response.text();
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
