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
    githubTokenConfigured: false,
    githubToken: undefined,
    cacheDir: "/missing",
    reloadSkills: () => registry(),
    logger: console
  });

  const result = await tools.spSkill.execute("call-1", { name: "using-superpowers" });
  assert.equal(result.content[0].type, "text");
  assert.match(result.content[0].text, /# Using Superpowers/);
});
