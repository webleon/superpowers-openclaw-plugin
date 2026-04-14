import type { SkillRecord } from "./skills.ts";

const ALWAYS_LOAD = ["using-superpowers"];
const KEYWORDS: Record<string, string[]> = {
  "brainstorming": [
    "需求", "想法", "思路", "方案对比", "比较方案", "取舍", "头脑风暴", "先聊聊", "先想清楚",
    "brainstorm", "explore options", "tradeoff", "tradeoffs", "approach", "approaches", "requirements"
  ],
  "writing-plans": [
    "计划", "规划", "实施计划", "拆解任务", "拆解", "步骤", "里程碑", "设计文档", "技术方案", "路线图",
    "plan", "implementation plan", "break down", "steps", "milestone", "spec", "design doc", "roadmap"
  ],
  "systematic-debugging": [
    "报错", "异常", "故障", "排查", "定位问题", "根因", "复现", "调试",
    "debug", "bug", "error", "failure", "investigate", "root cause", "reproduce"
  ],
  "test-driven-development": [
    "测试先行", "先写测试", "补测试", "测试用例",
    "tdd", "test first", "write tests", "test case", "unit test"
  ],
  "requesting-code-review": [
    "代码评审", "review 一下", "帮我 review",
    "code review", "review this", "review my changes"
  ],
  "receiving-code-review": [
    "review 意见", "评审意见", "审查意见",
    "review feedback", "requested changes", "address comments"
  ],
  "verification-before-completion": [
    "验收", "验证", "确认通过", "发布前检查",
    "verify", "validation", "preflight"
  ],
  "finishing-a-development-branch": [
    "准备合并", "准备提交", "发 pr", "收尾", "上线前检查",
    "merge", "open pr", "ready to land", "ship it", "finalize branch"
  ],
  "subagent-driven-development": [
    "并行", "分工", "子代理", "拆给多个 agent",
    "parallel", "subagent", "delegate", "split work"
  ],
  "using-git-worktrees": [
    "worktree", "隔离工作区", "独立工作目录",
    "isolated workspace"
  ],
};

const SUPERPOWERS_HINTS: Record<string, string[]> = {
  "brainstorming": ["方案", "思路", "想法", "取舍", "brainstorm", "approach"],
  "writing-plans": ["计划", "规划", "拆解", "plan", "spec"],
  "systematic-debugging": ["调试", "排查", "报错", "debug", "bug", "error"],
  "test-driven-development": ["测试", "tdd", "test"],
  "requesting-code-review": ["review", "评审"],
  "receiving-code-review": ["review feedback", "评审意见", "requested changes"],
  "finishing-a-development-branch": ["合并", "pr", "merge"],
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

  if (mentionsSuperpowers(promptLower)) {
    for (const [name, keywords] of Object.entries(SUPERPOWERS_HINTS)) {
      if (skills.has(name) && keywords.some((keyword) => promptLower.includes(keyword.toLowerCase()))) {
        names.add(name);
      }
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

function mentionsSuperpowers(promptLower: string): boolean {
  return promptLower.includes("superpowers")
    || promptLower.includes("super power")
    || promptLower.includes("用superpowers")
    || promptLower.includes("用 superpowers")
    || promptLower.includes("使用superpowers")
    || promptLower.includes("使用 superpowers");
}
