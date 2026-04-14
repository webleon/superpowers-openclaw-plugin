import assert from "node:assert/strict";
import test from "node:test";
import { buildPromptContext, deriveActiveSkillLabel, detectRelevantSkills, isStatusLikePrompt } from "../src/prompt.ts";
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
    }],
    ["brainstorming", {
      name: "brainstorming",
      description: "Use when exploring options.",
      path: "/cache/skills/brainstorming/SKILL.md",
      markdown: "---\nname: brainstorming\n---\n# Brainstorming",
      body: "# Brainstorming"
    }]
  ]);
}

test("detectRelevantSkills always includes using-superpowers when present", () => {
  assert.deepEqual(detectRelevantSkills("hello", registry()), [
    { name: "using-superpowers", matchedKeywords: [], usedSuperpowersBoost: false },
  ]);
});

test("detectRelevantSkills adds debugging skill for bug prompts", () => {
  assert.deepEqual(detectRelevantSkills("fix this bug", registry()), [
    { name: "using-superpowers", matchedKeywords: [], usedSuperpowersBoost: false },
    { name: "systematic-debugging", matchedKeywords: ["bug"], usedSuperpowersBoost: false },
  ]);
});

test("detectRelevantSkills adds brainstorming for planning-style prompts", () => {
  assert.deepEqual(detectRelevantSkills("先比较方案和取舍，再决定怎么做", registry()), [
    { name: "using-superpowers", matchedKeywords: [], usedSuperpowersBoost: false },
    { name: "brainstorming", matchedKeywords: ["比较方案", "取舍"], usedSuperpowersBoost: false },
  ]);
});

test("detectRelevantSkills boosts explicit superpowers requests", () => {
  assert.deepEqual(
    detectRelevantSkills("用 superpowers 帮我调试这个报错", registry()),
    [
      { name: "using-superpowers", matchedKeywords: [], usedSuperpowersBoost: false },
      { name: "systematic-debugging", matchedKeywords: ["报错", "调试"], usedSuperpowersBoost: true },
    ]
  );
});

test("buildPromptContext names sp_skill as the invocation tool", () => {
  const context = buildPromptContext(registry(), [
    { name: "using-superpowers", matchedKeywords: [], usedSuperpowersBoost: false },
  ]);
  assert.match(context, /sp_skill/);
  assert.match(context, /using-superpowers/);
  assert.match(context, /must call `sp_skill`/);
  assert.match(context, /Do not claim to be using a Superpowers skill/);
});

test("buildPromptContext lists suggested skills without inlining full skill markdown", () => {
  const context = buildPromptContext(registry(), [
    { name: "using-superpowers", matchedKeywords: [], usedSuperpowersBoost: false },
    { name: "brainstorming", matchedKeywords: ["比较方案", "取舍"], usedSuperpowersBoost: true },
  ]);
  assert.match(context, /Suggested skills for this request:/);
  assert.match(context, /- brainstorming \(比较方案, 取舍, superpowers\)/);
  assert.doesNotMatch(context, /# Brainstorming/);
});

test("buildPromptContext includes the active skill label instruction", () => {
  const context = buildPromptContext(
    registry(),
    [{ name: "brainstorming", matchedKeywords: ["方案", "取舍"], usedSuperpowersBoost: true }],
    { name: "brainstorming", indicators: ["方案", "取舍", "superpowers"] },
  );
  assert.match(context, /\*⚡ brainstorming \| 方案, 取舍, superpowers\*/);
  assert.match(context, /───/);
  assert.match(context, /same reply/);
});

test("buildPromptContext can omit label when no pending reply label exists", () => {
  const context = buildPromptContext(
    registry(),
    [{ name: "brainstorming", matchedKeywords: ["方案"], usedSuperpowersBoost: false }],
    null,
  );
  assert.doesNotMatch(context, /same reply/);
  assert.doesNotMatch(context, /\*⚡/);
});

test("isStatusLikePrompt detects status-oriented tool requests", () => {
  assert.equal(isStatusLikePrompt("请调用 sp_status，完整告诉我最近一次真实激活。"), true);
  assert.equal(isStatusLikePrompt("请调用 sp_update 更新缓存。"), true);
  assert.equal(isStatusLikePrompt("用 superpowers 帮我比较几个实现方案。"), false);
});

test("buildPromptContext can suppress activation labels for status-like replies", () => {
  const context = buildPromptContext(
    registry(),
    [{ name: "brainstorming", matchedKeywords: ["方案"], usedSuperpowersBoost: false }],
    { name: "brainstorming", indicators: ["方案", "superpowers"] },
    true,
  );
  assert.match(context, /Do not prepend any activation label or skill banner to this reply/);
  assert.doesNotMatch(context, /When answering the user, format the start of the same reply exactly like this:/);
});

test("deriveActiveSkillLabel returns null for using-superpowers", () => {
  assert.equal(deriveActiveSkillLabel("using-superpowers", []), null);
});

test("deriveActiveSkillLabel uses matched keywords and superpowers boost", () => {
  assert.deepEqual(
    deriveActiveSkillLabel("brainstorming", [
      { name: "brainstorming", matchedKeywords: ["方案", "取舍"], usedSuperpowersBoost: true },
    ]),
    { name: "brainstorming", indicators: ["方案", "取舍", "superpowers"] },
  );
});

test("sp_skill returns OpenClaw content format", async () => {
  let activeSkill = "unset";
  let lastActivation = null;
  const tools = createTools({
    skills: registry(),
    repoUrl: "https://github.com/obra/superpowers.git",
    githubTokenConfigured: false,
    githubToken: undefined,
    cacheDir: "/missing",
    getLatestMatches: () => [{ name: "using-superpowers", matchedKeywords: [], usedSuperpowersBoost: false }],
    getLastActivation: () => lastActivation,
    getPendingReplyLabel: () => null,
    setLastActivation: (nextActivation) => {
      lastActivation = nextActivation;
    },
    setActiveSkill: (nextActiveSkill) => {
      activeSkill = nextActiveSkill === null ? "cleared" : "set";
    },
    reloadSkills: () => registry(),
    logger: console
  });

  const result = await tools.spSkill.execute("call-1", { name: "using-superpowers" });
  assert.equal(result.content[0].type, "text");
  assert.match(result.content[0].text, /# Using Superpowers/);
  assert.equal(activeSkill, "cleared");
  assert.deepEqual(lastActivation, {
    skillName: "using-superpowers",
    activatedAt: lastActivation.activatedAt,
    matchedKeywords: [],
    usedSuperpowersBoost: false,
    source: "sp_skill",
  });
});

test("sp_skill stores active label only after successful non-base skill load", async () => {
  let activeSkill = null;
  let lastActivation = null;
  const tools = createTools({
    skills: registry(),
    repoUrl: "https://github.com/obra/superpowers.git",
    githubTokenConfigured: false,
    githubToken: undefined,
    cacheDir: "/missing",
    getLatestMatches: () => [{ name: "brainstorming", matchedKeywords: ["方案", "取舍"], usedSuperpowersBoost: true }],
    getLastActivation: () => lastActivation,
    getPendingReplyLabel: () => null,
    setLastActivation: (nextActivation) => {
      lastActivation = nextActivation;
    },
    setActiveSkill: (nextActiveSkill) => {
      activeSkill = nextActiveSkill;
    },
    reloadSkills: () => registry(),
    logger: console
  });

  const result = await tools.spSkill.execute("call-2", { name: "brainstorming" });
  assert.deepEqual(activeSkill, { name: "brainstorming", indicators: ["方案", "取舍", "superpowers"] });
  assert.deepEqual(lastActivation, {
    skillName: "brainstorming",
    activatedAt: lastActivation.activatedAt,
    matchedKeywords: ["方案", "取舍"],
    usedSuperpowersBoost: true,
    source: "sp_skill",
  });
  assert.match(result.content[0].text, /Activation label for the immediate next assistant reply:/);
  assert.match(result.content[0].text, /\*⚡ brainstorming \| 方案, 取舍, superpowers\*/);
  assert.match(result.content[0].text, /Show the label exactly once/);
});

test("sp_status reports the last real activation", async () => {
  const tools = createTools({
    skills: registry(),
    repoUrl: "https://github.com/obra/superpowers.git",
    githubTokenConfigured: true,
    githubToken: "token",
    cacheDir: "/missing",
    getLatestMatches: () => [],
    getLastActivation: () => ({
      skillName: "brainstorming",
      activatedAt: "2026-04-14T09:00:00.000Z",
      matchedKeywords: ["方案", "取舍"],
      usedSuperpowersBoost: true,
      source: "sp_skill",
    }),
    getPendingReplyLabel: () => ({ name: "brainstorming", indicators: ["方案", "取舍", "superpowers"] }),
    setLastActivation: () => {},
    setActiveSkill: () => {},
    reloadSkills: () => registry(),
    logger: console
  });

  const result = await tools.spStatus.execute("call-3", {});
  assert.match(result.content[0].text, /\[SP_STATUS_BEGIN\]/);
  assert.match(result.content[0].text, /last_activation=brainstorming/);
  assert.match(result.content[0].text, /activation_source=sp_skill/);
  assert.match(result.content[0].text, /matched_keywords=方案,取舍/);
  assert.match(result.content[0].text, /superpowers_boost=true/);
  assert.match(result.content[0].text, /pending_reply_label=brainstorming/);
  assert.match(result.content[0].text, /persistent_active_skill=none/);
  assert.match(result.content[0].text, /\[SP_STATUS_END\]/);
});
