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
