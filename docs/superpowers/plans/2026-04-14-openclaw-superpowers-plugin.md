# OpenClaw Superpowers Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the fork into a maintainable `openclaw-superpowers-plugin` that follows current OpenClaw plugin conventions and loads `obra/superpowers` skills through namespaced `sp_*` tools.

**Architecture:** Keep `index.ts` as a thin OpenClaw entrypoint and move behavior into focused `src/` modules. Package one static OpenClaw bridge skill in `skills/openclaw-superpowers/SKILL.md`; runtime-fetched upstream skills stay in a Git cache and are exposed through `sp_skill`, `sp_update`, and `sp_status`.

**Tech Stack:** TypeScript ESM, Node.js built-in `fs`, `path`, `url`, `child_process`, Node test runner, OpenClaw plugin SDK focused imports.

---

## File Map

- `index.ts`: OpenClaw entrypoint using `definePluginEntry`; wires config, cache, prompt hook, and tools.
- `src/config.ts`: default config and config normalization.
- `src/git-cache.ts`: Git clone, pull, status, and cache path helpers using `spawnSync` argument arrays.
- `src/skills.ts`: parse `SKILL.md`, load skills, resolve companion files, and build skill registry.
- `src/prompt.ts`: build compact prompt context and keyword-based skill selection.
- `src/tools.ts`: create OpenClaw-compatible `sp_skill`, `sp_update`, and `sp_status` tools.
- `skills/openclaw-superpowers/SKILL.md`: packaged bridge skill that instructs agents to call `sp_skill`.
- `test/fixtures/superpowers/skills/*/SKILL.md`: minimal fixtures for parser and loader tests.
- `test/*.test.ts`: Node test runner coverage for modules that do not need a live OpenClaw host.
- `package.json`: rename package, add scripts, package metadata, and OpenClaw metadata.
- `openclaw.plugin.json`: rename plugin, add `contracts.tools`, packaged skill declaration, and corrected config schema.
- `README.md` and `README_zh.md`: update installation, usage, config, and publishing docs.

## Task 1: Package Identity And Test Harness

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Test: `test/package-metadata.test.ts`

- [ ] **Step 1: Write the failing metadata test**

Create `test/package-metadata.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/package-metadata.test.ts`

Expected: FAIL because the package is still named `@vruru/superpowers-bridge`.

- [ ] **Step 3: Update package metadata and test script**

Modify `package.json` to:

```json
{
  "name": "openclaw-superpowers-plugin",
  "version": "0.1.0",
  "description": "OpenClaw plugin that bridges to Superpowers workflow skills from obra/superpowers",
  "type": "module",
  "main": "index.ts",
  "scripts": {
    "test": "node --test test/*.test.ts",
    "pack:dry-run": "npm pack --dry-run"
  },
  "keywords": ["openclaw", "superpowers", "skills", "workflow"],
  "author": "webleon",
  "license": "MIT",
  "openclaw": {
    "extensions": ["./index.ts"],
    "compat": {
      "minApiVersion": 1
    },
    "build": {
      "entry": "./index.ts"
    },
    "install": {
      "npmSpec": "openclaw-superpowers-plugin",
      "localPathHint": "~/.openclaw/workspace/plugins/superpowers-openclaw-plugin"
    }
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/webleon/superpowers-openclaw-plugin"
  },
  "publishConfig": {
    "access": "public"
  },
  "files": [
    "index.ts",
    "src/",
    "skills/",
    "openclaw.plugin.json",
    "README.md",
    "README_zh.md"
  ]
}
```

- [ ] **Step 4: Update package lock metadata**

Run: `npm install --package-lock-only`

Expected: `package-lock.json` updates the root package name and version without adding runtime dependencies.

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test test/package-metadata.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json test/package-metadata.test.ts
git commit -m "chore: update package identity"
```

## Task 2: Manifest And Static Bridge Skill

**Files:**
- Modify: `openclaw.plugin.json`
- Create: `skills/openclaw-superpowers/SKILL.md`
- Test: `test/package-metadata.test.ts`

- [ ] **Step 1: Extend the failing metadata test**

Update `test/package-metadata.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/package-metadata.test.ts`

Expected: FAIL because manifest fields and bridge skill are missing.

- [ ] **Step 3: Update OpenClaw manifest**

Replace `openclaw.plugin.json` with:

```json
{
  "id": "openclaw-superpowers-plugin",
  "name": "OpenClaw Superpowers Plugin",
  "description": "Bridge to Superpowers workflow skills from obra/superpowers",
  "version": "0.1.0",
  "kind": "extension",
  "contracts": {
    "tools": ["sp_skill", "sp_update", "sp_status"]
  },
  "skills": ["skills/openclaw-superpowers/SKILL.md"],
  "configSchema": {
    "type": "object",
    "additionalProperties": false,
    "properties": {
      "skillsRepo": {
        "type": "string",
        "default": "https://github.com/obra/superpowers.git",
        "description": "Git repository URL for upstream Superpowers skills"
      },
      "docsPath": {
        "type": "string",
        "default": "docs/superpowers",
        "description": "Default path for Superpowers design and plan documents"
      },
      "autoDetectCode": {
        "type": "boolean",
        "default": true,
        "description": "Auto-detect relevant Superpowers skills from prompt text"
      },
      "autoUpdate": {
        "type": "boolean",
        "default": false,
        "description": "Run git pull for upstream skills when the plugin starts"
      }
    }
  }
}
```

- [ ] **Step 4: Add the packaged bridge skill**

Create `skills/openclaw-superpowers/SKILL.md`:

```markdown
---
name: openclaw-superpowers
description: Use when a task may benefit from Superpowers workflow skills; loads upstream skills through the OpenClaw Superpowers plugin tools.
---

# OpenClaw Superpowers Bridge

Superpowers skills are available through OpenClaw tools provided by this plugin.

## Required Behavior

- Before starting a task, decide whether a Superpowers skill applies.
- To load a skill, call `sp_skill` with the skill name.
- To inspect available skills and the cached upstream version, call `sp_status`.
- To update the upstream skill cache, call `sp_update` only when the user asks to update or when freshness is required.

## Tool Mapping

- `sp_skill` is the OpenClaw equivalent of invoking a Superpowers skill.
- `sp_status` reports the cached `obra/superpowers` commit and loaded skill count.
- `sp_update` pulls the latest upstream skills and reloads the plugin registry.

User instructions take priority over Superpowers skills. Follow the loaded skill content exactly after `sp_skill` returns it.
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test test/package-metadata.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add openclaw.plugin.json skills/openclaw-superpowers/SKILL.md test/package-metadata.test.ts
git commit -m "feat: declare OpenClaw plugin manifest"
```

## Task 3: Config And Skill Parser Modules

**Files:**
- Create: `src/config.ts`
- Create: `src/skills.ts`
- Create: `test/fixtures/superpowers/skills/using-superpowers/SKILL.md`
- Create: `test/fixtures/superpowers/skills/brainstorming/SKILL.md`
- Create: `test/skills.test.ts`

- [ ] **Step 1: Write failing parser and config tests**

Create `test/fixtures/superpowers/skills/using-superpowers/SKILL.md`:

```markdown
---
name: using-superpowers
description: Use when starting any conversation - establishes how to find and use skills.
---

# Using Superpowers

Invoke relevant skills before action.
```

Create `test/fixtures/superpowers/skills/brainstorming/SKILL.md`:

```markdown
---
name: brainstorming
description: Use before creative work.
---

# Brainstorming

Ask questions before implementation.
```

Create `test/skills.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { normalizeConfig } from "../src/config.ts";
import { loadSkills, parseSkillMarkdown } from "../src/skills.ts";

test("normalizeConfig applies predictable defaults and no enabled field", () => {
  const config = normalizeConfig({ autoUpdate: true });
  assert.equal(config.skillsRepo, "https://github.com/obra/superpowers.git");
  assert.equal(config.docsPath, "docs/superpowers");
  assert.equal(config.autoDetectCode, true);
  assert.equal(config.autoUpdate, true);
  assert.equal(Object.prototype.hasOwnProperty.call(config, "enabled"), false);
});

test("parseSkillMarkdown returns metadata and full markdown", () => {
  const markdown = [
    "---",
    "name: example",
    "description: Use when an example is needed.",
    "---",
    "",
    "# Example",
    "",
    "Body text."
  ].join("\n");

  const skill = parseSkillMarkdown(markdown, "/cache/skills/example/SKILL.md");
  assert.equal(skill.name, "example");
  assert.equal(skill.description, "Use when an example is needed.");
  assert.equal(skill.path, "/cache/skills/example/SKILL.md");
  assert.equal(skill.markdown, markdown);
  assert.match(skill.body, /Body text/);
});

test("loadSkills reads skills from the upstream skills directory layout", () => {
  const registry = loadSkills("test/fixtures/superpowers/skills");
  assert.deepEqual([...registry.keys()].sort(), ["brainstorming", "using-superpowers"]);
  assert.match(registry.get("using-superpowers")?.markdown ?? "", /Invoke relevant skills/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/skills.test.ts`

Expected: FAIL because `src/config.ts` and `src/skills.ts` do not exist.

- [ ] **Step 3: Implement config module**

Create `src/config.ts`:

```ts
export interface PluginConfig {
  skillsRepo: string;
  docsPath: string;
  autoDetectCode: boolean;
  autoUpdate: boolean;
}

export const DEFAULT_CONFIG: PluginConfig = {
  skillsRepo: "https://github.com/obra/superpowers.git",
  docsPath: "docs/superpowers",
  autoDetectCode: true,
  autoUpdate: false,
};

export function normalizeConfig(input: Partial<PluginConfig> = {}): PluginConfig {
  return {
    skillsRepo: typeof input.skillsRepo === "string" && input.skillsRepo.length > 0
      ? input.skillsRepo
      : DEFAULT_CONFIG.skillsRepo,
    docsPath: typeof input.docsPath === "string" && input.docsPath.length > 0
      ? input.docsPath
      : DEFAULT_CONFIG.docsPath,
    autoDetectCode: input.autoDetectCode ?? DEFAULT_CONFIG.autoDetectCode,
    autoUpdate: input.autoUpdate ?? DEFAULT_CONFIG.autoUpdate,
  };
}
```

- [ ] **Step 4: Implement skill parser and loader**

Create `src/skills.ts`:

```ts
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export interface SkillRecord {
  name: string;
  description: string;
  path: string;
  markdown: string;
  body: string;
}

function parseFrontmatter(frontmatter: string): { name?: string; description?: string } {
  const result: { name?: string; description?: string } = {};

  for (const line of frontmatter.split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!match) continue;
    const key = match[1];
    const value = match[2].trim().replace(/^["']|["']$/g, "");
    if (key === "name") result.name = value;
    if (key === "description") result.description = value;
  }

  return result;
}

export function parseSkillMarkdown(markdown: string, filePath: string): SkillRecord {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    throw new Error(`Skill file is missing frontmatter: ${filePath}`);
  }

  const metadata = parseFrontmatter(match[1]);
  if (!metadata.name) {
    throw new Error(`Skill file is missing name: ${filePath}`);
  }

  return {
    name: metadata.name,
    description: metadata.description ?? "",
    path: filePath,
    markdown,
    body: match[2].trim(),
  };
}

export function loadSkills(skillsDir: string): Map<string, SkillRecord> {
  const registry = new Map<string, SkillRecord>();
  if (!existsSync(skillsDir)) return registry;

  for (const entry of readdirSync(skillsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const skillPath = join(skillsDir, entry.name, "SKILL.md");
    if (!existsSync(skillPath)) continue;
    const markdown = readFileSync(skillPath, "utf8");
    const skill = parseSkillMarkdown(markdown, skillPath);
    registry.set(skill.name, skill);
  }

  return registry;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --test test/skills.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/config.ts src/skills.ts test/fixtures/superpowers/skills test/skills.test.ts
git commit -m "feat: add skill loading modules"
```

## Task 4: Git Cache Module

**Files:**
- Create: `src/git-cache.ts`
- Create: `test/git-cache.test.ts`

- [ ] **Step 1: Write failing git cache tests**

Create `test/git-cache.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/git-cache.test.ts`

Expected: FAIL because `src/git-cache.ts` does not exist.

- [ ] **Step 3: Implement git cache module**

Create `src/git-cache.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/git-cache.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/git-cache.ts test/git-cache.test.ts
git commit -m "feat: add superpowers git cache"
```

## Task 5: Prompt And Tools Modules

**Files:**
- Create: `src/prompt.ts`
- Create: `src/tools.ts`
- Create: `test/prompt-tools.test.ts`

- [ ] **Step 1: Write failing prompt and tool tests**

Create `test/prompt-tools.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { buildPromptContext, detectRelevantSkills } from "../src/prompt.ts";
import { createTools } from "../src/tools.ts";
import type { SkillRecord } from "../src/skills.ts";

function registry(): Map<string, SkillRecord> {
  return new Map([
    ["using-superpowers", {
      name: "using-superpowers",
      description: "Use when starting any conversation.",
      path: "/cache/skills/using-superpowers/SKILL.md",
      markdown: "---\nname: using-superpowers\n---\n# Using Superpowers",
      body: "# Using Superpowers"
    }],
    ["systematic-debugging", {
      name: "systematic-debugging",
      description: "Use when debugging failures.",
      path: "/cache/skills/systematic-debugging/SKILL.md",
      markdown: "---\nname: systematic-debugging\n---\n# Debugging",
      body: "# Debugging"
    }]
  ]);
}

test("detectRelevantSkills always includes using-superpowers when present", () => {
  assert.deepEqual(detectRelevantSkills("hello", registry()), ["using-superpowers"]);
});

test("detectRelevantSkills adds debugging skill for bug prompts", () => {
  assert.deepEqual(detectRelevantSkills("fix this bug", registry()), ["using-superpowers", "systematic-debugging"]);
});

test("buildPromptContext names sp_skill as the invocation tool", () => {
  const context = buildPromptContext(registry(), ["using-superpowers"]);
  assert.match(context, /sp_skill/);
  assert.match(context, /using-superpowers/);
});

test("sp_skill returns OpenClaw content format", async () => {
  const tools = createTools({
    skills: registry(),
    repoUrl: "https://github.com/obra/superpowers.git",
    cacheDir: "/missing",
    reloadSkills: () => registry(),
    logger: console
  });

  const result = await tools.spSkill.execute("call-1", { name: "using-superpowers" });
  assert.equal(result.content[0].type, "text");
  assert.match(result.content[0].text, /# Using Superpowers/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/prompt-tools.test.ts`

Expected: FAIL because `src/prompt.ts` and `src/tools.ts` do not exist.

- [ ] **Step 3: Implement prompt module**

Create `src/prompt.ts`:

```ts
import type { SkillRecord } from "./skills.ts";

const ALWAYS_LOAD = ["using-superpowers"];
const KEYWORDS: Record<string, string[]> = {
  "brainstorming": ["写代码", "编写", "实现", "开发", "创建", "构建", "feature", "implement", "develop", "create", "build"],
  "writing-plans": ["计划", "规划", "方案", "plan", "spec", "设计", "design"],
  "subagent-driven-development": ["执行", "execute", "task"],
  "test-driven-development": ["测试", "test", "tdd", "unittest", "jest", "mocha"],
  "systematic-debugging": ["调试", "debug", "修复", "fix", "bug", "错误", "error", "issue"],
  "using-git-worktrees": ["分支", "branch", "worktree", "git"],
  "finishing-a-development-branch": ["完成", "结束", "合并", "merge", "pr", "pull request"],
};

export function detectRelevantSkills(prompt: string, skills: Map<string, SkillRecord>): string[] {
  const promptLower = prompt.toLowerCase();
  const names = new Set<string>();

  for (const name of ALWAYS_LOAD) {
    if (skills.has(name)) names.add(name);
  }

  for (const [name, keywords] of Object.entries(KEYWORDS)) {
    if (skills.has(name) && keywords.some((keyword) => promptLower.includes(keyword.toLowerCase()))) {
      names.add(name);
    }
  }

  return [...names];
}

export function buildPromptContext(skills: Map<string, SkillRecord>, selected: string[]): string {
  const available = [...skills.values()]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((skill) => `- ${skill.name}: ${skill.description}`)
    .join("\n");

  const sections = [
    "# OpenClaw Superpowers Bridge",
    "",
    "Superpowers skills from obra/superpowers are available through `sp_skill`.",
    "Use `sp_skill` as the OpenClaw equivalent of invoking a Superpowers skill.",
    "Use `sp_status` to inspect the cache and `sp_update` only when updates are requested or freshness is required.",
    "",
    "Available skills:",
    available || "- No upstream skills loaded.",
  ];

  for (const name of selected) {
    const skill = skills.get(name);
    if (!skill) continue;
    sections.push("", `## ${skill.name}`, skill.markdown);
  }

  return sections.join("\n");
}
```

- [ ] **Step 4: Implement tools module**

Create `src/tools.ts`:

```ts
import { getGitStatus, updateSkillsCache } from "./git-cache.ts";
import type { SkillRecord } from "./skills.ts";

interface ToolContent {
  type: "text";
  text: string;
}

interface ToolResult {
  content: ToolContent[];
}

interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute(id: string, params: Record<string, unknown>): Promise<ToolResult>;
}

export interface ToolFactoryInput {
  skills: Map<string, SkillRecord>;
  repoUrl: string;
  cacheDir: string;
  reloadSkills(): Map<string, SkillRecord>;
  logger: Pick<Console, "info" | "error">;
}

function text(content: string): ToolResult {
  return { content: [{ type: "text", text: content }] };
}

export function createTools(input: ToolFactoryInput): {
  spSkill: ToolDefinition;
  spUpdate: ToolDefinition;
  spStatus: ToolDefinition;
} {
  const spSkill: ToolDefinition = {
    name: "sp_skill",
    description: "Load an upstream Superpowers skill by name.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Superpowers skill name" },
      },
      required: ["name"],
    },
    async execute(_id, params) {
      const name = typeof params.name === "string" ? params.name : "";
      const skill = input.skills.get(name);
      if (!skill) {
        return text(`Skill '${name}' not found. Available skills: ${[...input.skills.keys()].sort().join(", ")}`);
      }

      return text([
        `Skill: ${skill.name}`,
        `Description: ${skill.description}`,
        `Path: ${skill.path}`,
        "",
        skill.markdown,
      ].join("\n"));
    },
  };

  const spUpdate: ToolDefinition = {
    name: "sp_update",
    description: "Pull the latest upstream Superpowers skills and reload the registry.",
    parameters: { type: "object", properties: {} },
    async execute() {
      const result = updateSkillsCache(input.cacheDir);
      if (!result.success) return text(`Update failed: ${result.message}`);

      const next = input.reloadSkills();
      input.skills.clear();
      for (const [name, skill] of next) input.skills.set(name, skill);
      return text(`Update complete: ${result.message}\nLoaded skills: ${input.skills.size}`);
    },
  };

  const spStatus: ToolDefinition = {
    name: "sp_status",
    description: "Report upstream Superpowers cache status.",
    parameters: { type: "object", properties: {} },
    async execute() {
      const status = getGitStatus(input.cacheDir, input.repoUrl);
      return text([
        `Repo: ${input.repoUrl}`,
        `Loaded skills: ${input.skills.size}`,
        `Cache loaded: ${status.loaded}`,
        status.commit ? `Commit: ${status.commit}` : undefined,
        status.date ? `Date: ${status.date}` : undefined,
        `Status: ${status.message}`,
      ].filter(Boolean).join("\n"));
    },
  };

  return { spSkill, spUpdate, spStatus };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --test test/prompt-tools.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/prompt.ts src/tools.ts test/prompt-tools.test.ts
git commit -m "feat: add prompt and tool modules"
```

## Task 6: OpenClaw Entrypoint

**Files:**
- Modify: `index.ts`
- Test: `test/package-metadata.test.ts`

- [ ] **Step 1: Write failing entrypoint metadata test**

Append to `test/package-metadata.test.ts`:

```ts
test("entrypoint uses definePluginEntry and namespaced tool registrations", () => {
  const entrypoint = readFileSync("index.ts", "utf8");
  assert.match(entrypoint, /definePluginEntry/);
  assert.match(entrypoint, /spSkill/);
  assert.match(entrypoint, /spUpdate/);
  assert.match(entrypoint, /spStatus/);
  assert.doesNotMatch(entrypoint, /update_superpowers_skills/);
  assert.doesNotMatch(entrypoint, /superpowers_version/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/package-metadata.test.ts`

Expected: FAIL because `index.ts` still has the old plugin shape and old tool names.

- [ ] **Step 3: Replace entrypoint**

Replace `index.ts` with:

```ts
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import { normalizeConfig } from "./src/config.ts";
import { ensureSkillsCache, getCachePaths, updateSkillsCache } from "./src/git-cache.ts";
import { loadSkills } from "./src/skills.ts";
import { buildPromptContext, detectRelevantSkills } from "./src/prompt.ts";
import { createTools } from "./src/tools.ts";

const pluginDir = dirname(fileURLToPath(import.meta.url));

export default definePluginEntry((api) => {
  const config = normalizeConfig(api.pluginConfig ?? {});
  const paths = getCachePaths(pluginDir);

  const ensureResult = ensureSkillsCache(pluginDir, config.skillsRepo);
  if (!ensureResult.success) {
    api.logger.error(`[OpenClaw Superpowers] ${ensureResult.message}`);
  }

  if (config.autoUpdate && ensureResult.success) {
    const updateResult = updateSkillsCache(paths.cacheDir);
    if (!updateResult.success) {
      api.logger.error(`[OpenClaw Superpowers] auto-update failed: ${updateResult.message}`);
    }
  }

  const skills = loadSkills(paths.skillsDir);
  api.logger.info(`[OpenClaw Superpowers] loaded ${skills.size} upstream skills`);

  const tools = createTools({
    skills,
    repoUrl: config.skillsRepo,
    cacheDir: paths.cacheDir,
    reloadSkills: () => loadSkills(paths.skillsDir),
    logger: api.logger,
  });

  api.registerTool(tools.spSkill);
  api.registerTool(tools.spUpdate);
  api.registerTool(tools.spStatus);

  const promptHook = (event: { prompt?: string }) => {
    if (skills.size === 0) return {};
    const prompt = event.prompt ?? "";
    const selected = config.autoDetectCode
      ? detectRelevantSkills(prompt, skills)
      : skills.has("using-superpowers") ? ["using-superpowers"] : [];

    return {
      appendSystemContext: buildPromptContext(skills, selected),
    };
  };

  if (typeof api.on === "function") {
    api.on("before_prompt_build", promptHook);
  }
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/package-metadata.test.ts`

Expected: PASS.

- [ ] **Step 5: Run all module tests**

Run: `npm test`

Expected: PASS for all tests.

- [ ] **Step 6: Commit**

```bash
git add index.ts test/package-metadata.test.ts
git commit -m "feat: wire OpenClaw plugin entrypoint"
```

## Task 7: Documentation

**Files:**
- Modify: `README.md`
- Modify: `README_zh.md`

- [ ] **Step 1: Write failing docs metadata test**

Append to `test/package-metadata.test.ts`:

```ts
test("readme documents owned install paths and sp tools", () => {
  const readme = readFileSync("README.md", "utf8");
  assert.match(readme, /openclaw-superpowers-plugin/);
  assert.match(readme, /webleon\/superpowers-openclaw-plugin/);
  assert.match(readme, /sp_skill/);
  assert.match(readme, /sp_update/);
  assert.match(readme, /sp_status/);
  assert.doesNotMatch(readme, /@vruru\/superpowers-bridge/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/package-metadata.test.ts`

Expected: FAIL because README still documents the old package and tool names.

- [ ] **Step 3: Update README files**

Rewrite both READMEs to cover:

- npm install: `openclaw plugins install openclaw-superpowers-plugin`
- source install from `https://github.com/webleon/superpowers-openclaw-plugin.git`
- config example under `plugins.entries.openclaw-superpowers-plugin.config`
- tools: `sp_skill`, `sp_update`, `sp_status`
- upstream source: `https://github.com/obra/superpowers`
- npm publishing checklist: `npm test`, `npm run pack:dry-run`, `npm publish`

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/package-metadata.test.ts`

Expected: PASS.

- [ ] **Step 5: Run all tests**

Run: `npm test`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add README.md README_zh.md test/package-metadata.test.ts
git commit -m "docs: update OpenClaw superpowers plugin usage"
```

## Task 8: Final Verification

**Files:**
- No new files expected unless verification exposes a defect.

- [ ] **Step 1: Run all automated tests**

Run: `npm test`

Expected: PASS.

- [ ] **Step 2: Run package dry run**

Run: `npm run pack:dry-run`

Expected: output includes `index.ts`, `src/`, `skills/`, `openclaw.plugin.json`, `README.md`, and excludes `.superpowers-cache`.

- [ ] **Step 3: Inspect final status**

Run: `git status --short`

Expected: clean.

- [ ] **Step 4: Commit any verification fixes**

If any fixes were required:

```bash
git add <fixed-files>
git commit -m "fix: address final verification issues"
```

If no fixes were required, do not create an empty commit.
