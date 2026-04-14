import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import * as fs from "node:fs";
import { get as httpsGet } from "node:https";
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
const LOCK_DIR = ".sync-lock";
const LOCK_WAIT_MS = 30000;
const STALE_LOCK_MS = 60000;

export function getCachePaths(pluginDir: string): CachePaths {
  const cacheDir = join(pluginDir, ".superpowers-cache");
  return {
    cacheDir,
    skillsDir: join(cacheDir, "skills"),
  };
}

export async function ensureSkillsCache(pluginDir: string, repoUrl: string, githubToken?: string): Promise<GitResult & CachePaths> {
  const paths = getCachePaths(pluginDir);
  if (isCacheReady(paths)) {
    return { ...paths, success: true, message: "Skills already cached" };
  }

  if (existsSync(join(paths.cacheDir, LOCK_DIR))) {
    const ready = await waitForCacheReady(paths, LOCK_WAIT_MS);
    if (ready) {
      return { ...paths, success: true, message: "Skills became available while another sync was in progress" };
    }
  }

  const result = await syncSkillsCache(paths.cacheDir, repoUrl, githubToken);
  return { ...paths, ...result };
}

export async function updateSkillsCache(cacheDir: string, repoUrl: string, githubToken?: string): Promise<GitResult> {
  return syncSkillsCache(cacheDir, repoUrl, githubToken);
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

async function syncSkillsCache(cacheDir: string, repoUrl: string, githubToken?: string): Promise<GitResult> {
  const repo = parseGitHubRepo(repoUrl);
  if (!repo) {
    return { success: false, message: `Only GitHub repo URLs are supported for safe sync: ${repoUrl}` };
  }

  mkdirSync(cacheDir, { recursive: true });
  return withCacheLock(cacheDir, async () => {
    try {
      const commit = await fetchJson<{
        sha: string;
        commit: { committer?: { date?: string }; author?: { date?: string } };
      }>(`https://api.github.com/repos/${repo.owner}/${repo.repo}/commits/${repo.branch}`, githubToken);
      const tree = await fetchJson<{
        tree: Array<{ path: string; type: string; url: string }>;
      }>(`https://api.github.com/repos/${repo.owner}/${repo.repo}/git/trees/${commit.sha}?recursive=1`, githubToken);

      const skillFiles = tree.tree.filter((entry) => entry.type === "blob" && entry.path.startsWith("skills/"));
      const nextSkillsDir = mkdtempSync(join(cacheDir, "skills.next-"));
      const skillsDir = join(cacheDir, "skills");

      try {
        for (const entry of skillFiles) {
          const target = join(nextSkillsDir, entry.path.slice("skills/".length));
          mkdirSync(dirname(target), { recursive: true });
          const source = `https://raw.githubusercontent.com/${repo.owner}/${repo.repo}/${commit.sha}/${entry.path}`;
          writeFileSync(target, await fetchText(source, githubToken), "utf8");
        }

        rmSync(skillsDir, { recursive: true, force: true });
        fs.renameSync(nextSkillsDir, skillsDir);
      } catch (error) {
        rmSync(nextSkillsDir, { recursive: true, force: true });
        throw error;
      }

      writeFileSync(join(cacheDir, METADATA_FILE), JSON.stringify({
        repoUrl,
        commit: commit.sha,
        date: commit.commit.committer?.date ?? commit.commit.author?.date,
      } satisfies CacheMetadata, null, 2), "utf8");

      return { success: true, message: `Skills synced at ${commit.sha.slice(0, 7)} (${skillFiles.length} files)` };
    } catch (error) {
      return { success: false, message: errorMessage(error) };
    }
  });
}

function parseGitHubRepo(repoUrl: string): GitHubRepo | null {
  const https = repoUrl.match(/^https:\/\/github\.com\/([^/]+)\/([^/.]+)(?:\.git)?$/);
  if (https) return { owner: https[1], repo: https[2], branch: "main" };

  const ssh = repoUrl.match(/^git@github\.com:([^/]+)\/([^/.]+)(?:\.git)?$/);
  if (ssh) return { owner: ssh[1], repo: ssh[2], branch: "main" };

  return null;
}

async function fetchJson<T>(url: string, githubToken?: string): Promise<T> {
  return JSON.parse(await fetchText(url, githubToken)) as T;
}

async function fetchText(url: string, githubToken?: string): Promise<string> {
  return requestWithRetry(url, githubToken, 2);
}

async function requestText(url: string, githubToken: string | undefined, redirectCount: number): Promise<string> {
  if (redirectCount > 5) {
    throw new Error(`Too many redirects: ${url}`);
  }

  return new Promise((resolve, reject) => {
    const request = httpsGet(url, {
      headers: buildHeaders(githubToken),
    }, (response) => {
      const statusCode = response.statusCode ?? 0;
      const location = response.headers.location;

      if (statusCode >= 300 && statusCode < 400 && location) {
        response.resume();
        resolve(requestText(new URL(location, url).toString(), githubToken, redirectCount + 1));
        return;
      }

      if (statusCode < 200 || statusCode >= 300) {
        response.resume();
        reject(new Error(`${statusCode} ${response.statusMessage ?? "Request failed"}: ${url}`));
        return;
      }

      response.setEncoding("utf8");
      let body = "";
      response.on("data", (chunk) => {
        body += chunk;
      });
      response.on("end", () => resolve(body));
    });

    request.setTimeout(15000, () => {
      request.destroy(new Error(`Request timeout: ${url}`));
    });
    request.on("error", reject);
  });
}

async function requestWithRetry(url: string, githubToken: string | undefined, retries: number): Promise<string> {
  try {
    return await requestText(url, githubToken, 0);
  } catch (error) {
    if (retries <= 0 || !isTransientNetworkError(error)) {
      throw error;
    }
    await sleep(300);
    return requestWithRetry(url, githubToken, retries - 1);
  }
}

async function withCacheLock<T>(cacheDir: string, work: () => Promise<T>): Promise<T> {
  const lockPath = join(cacheDir, LOCK_DIR);
  const deadline = Date.now() + LOCK_WAIT_MS;

  while (true) {
    try {
      mkdirSync(lockPath);
      break;
    } catch (error) {
      if (!isAlreadyExistsError(error)) {
        throw error;
      }

      clearStaleLock(lockPath);

      if (Date.now() >= deadline) {
        throw new Error("Timed out waiting for skills cache lock");
      }

      await sleep(250);
    }
  }

  try {
    return await work();
  } finally {
    rmSync(lockPath, { recursive: true, force: true });
  }
}

function isCacheReady(paths: CachePaths): boolean {
  return existsSync(join(paths.cacheDir, METADATA_FILE)) && existsSync(paths.skillsDir);
}

async function waitForCacheReady(paths: CachePaths, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  const lockPath = join(paths.cacheDir, LOCK_DIR);

  while (Date.now() < deadline) {
    if (isCacheReady(paths)) {
      return true;
    }
    clearStaleLock(lockPath);
    await sleep(250);
  }

  return isCacheReady(paths);
}

function clearStaleLock(lockPath: string): void {
  if (!existsSync(lockPath)) {
    return;
  }

  try {
    const ageMs = Date.now() - statSync(lockPath).mtimeMs;
    if (ageMs >= STALE_LOCK_MS) {
      rmSync(lockPath, { recursive: true, force: true });
    }
  } catch {
    // Ignore lock inspection failures and let the normal wait/retry path continue.
  }
}

function isAlreadyExistsError(error: unknown): boolean {
  return typeof error === "object"
    && error !== null
    && "code" in error
    && (error as { code?: string }).code === "EEXIST";
}

function isTransientNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return /socket hang up|ECONNRESET|ETIMEDOUT|EAI_AGAIN/i.test(error.message);
}

function buildHeaders(githubToken?: string): Record<string, string> {
  return githubToken
    ? {
        "User-Agent": "superpowers-openclaw-plugin",
        "Authorization": `Bearer ${githubToken}`,
      }
    : { "User-Agent": "superpowers-openclaw-plugin" };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
