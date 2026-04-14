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
