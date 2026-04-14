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

export interface SkillMatch {
  name: string;
  matchedKeywords: string[];
  usedSuperpowersBoost: boolean;
}

export interface ActiveSkillLabel {
  name: string;
  indicators: string[];
}

export function detectRelevantSkills(prompt: string, skills: Map<string, SkillRecord>): SkillMatch[] {
  const promptLower = prompt.toLowerCase();
  const matches = new Map<string, SkillMatch>();
  const usedSuperpowersBoost = mentionsSuperpowers(promptLower);

  for (const name of ALWAYS_LOAD) {
    if (skills.has(name)) {
      matches.set(name, {
        name,
        matchedKeywords: [],
        usedSuperpowersBoost: false,
      });
    }
  }

  for (const [name, keywords] of Object.entries(KEYWORDS)) {
    if (!skills.has(name)) continue;
    const matchedKeywords = keywords.filter((keyword) => promptLower.includes(keyword.toLowerCase()));
    if (matchedKeywords.length === 0) continue;
    matches.set(name, {
      name,
      matchedKeywords,
      usedSuperpowersBoost: false,
    });
  }

  if (usedSuperpowersBoost) {
    for (const [name, keywords] of Object.entries(SUPERPOWERS_HINTS)) {
      if (!skills.has(name)) continue;
      const matchedKeywords = keywords.filter((keyword) => promptLower.includes(keyword.toLowerCase()));
      if (matchedKeywords.length === 0) continue;

      const current = matches.get(name);
      matches.set(name, {
        name,
        matchedKeywords: uniqueKeywords([
          ...(current?.matchedKeywords ?? []),
          ...matchedKeywords,
        ]),
        usedSuperpowersBoost: true,
      });
    }
  }

  return [...matches.values()];
}

export function buildPromptContext(
  skills: Map<string, SkillRecord>,
  selected: SkillMatch[],
  activeSkill?: ActiveSkillLabel | null,
): string {
  const available = [...skills.values()]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((skill) => `- ${skill.name}: ${skill.description}`)
    .join("\n");

  const sections = [
    "# OpenClaw Superpowers Bridge",
    "",
    "Superpowers skills from obra/superpowers are available through `sp_skill`.",
    "Use `sp_skill` as the OpenClaw equivalent of invoking a Superpowers skill.",
    "If you decide to use any upstream Superpowers skill such as `brainstorming`, `writing-plans`, or `systematic-debugging`, you must call `sp_skill` for that skill before giving any skill-based answer.",
    "Do not claim to be using a Superpowers skill unless `sp_skill` has already successfully loaded it in the current turn.",
    "Use `sp_status` to inspect the cache and `sp_update` only when updates are requested or freshness is required.",
  ];

  if (activeSkill) {
    sections.push(
      "",
      "When answering the user, format the start of the same reply exactly like this:",
      formatActivationLabel(activeSkill),
      "",
      "───",
      "",
      "Then continue with the actual answer.",
      "Only show this label after a Superpowers skill has been successfully loaded through `sp_skill`.",
      "Show the label exactly once, at the top of the same reply, and never as a separate message.",
    );
  }

  sections.push(
    "",
    "Available skills:",
    available || "- No upstream skills loaded.",
  );

  const suggested = selected
    .filter((match) => match.name !== "using-superpowers")
    .map((match) => {
      const reasonParts = [
        ...match.matchedKeywords.slice(0, 3),
        ...(match.usedSuperpowersBoost ? ["superpowers"] : []),
      ];
      const reason = reasonParts.length > 0 ? ` (${reasonParts.join(", ")})` : "";
      return `- ${match.name}${reason}`;
    })
    .join("\n");

  if (suggested) {
    sections.push(
      "",
      "Suggested skills for this request:",
      suggested,
      "Load a suggested skill with `sp_skill` before using it in the answer.",
    );
  }

  return sections.join("\n");
}

export function deriveActiveSkillLabel(skillName: string, matches: SkillMatch[]): ActiveSkillLabel | null {
  if (skillName === "using-superpowers") {
    return null;
  }

  const match = matches.find((entry) => entry.name === skillName);
  if (!match) {
    return { name: skillName, indicators: [] };
  }

  const indicators = uniqueKeywords([
    ...match.matchedKeywords.slice(0, 3),
    ...(match.usedSuperpowersBoost ? ["superpowers"] : []),
  ]);

  return { name: skillName, indicators };
}

export function formatActivationLabel(activeSkill: ActiveSkillLabel): string {
  if (activeSkill.indicators.length === 0) {
    return `*⚡ ${activeSkill.name}*`;
  }

  return `*⚡ ${activeSkill.name} | ${activeSkill.indicators.join(", ")}*`;
}

function uniqueKeywords(values: string[]): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }
  return result;
}

function mentionsSuperpowers(promptLower: string): boolean {
  return promptLower.includes("superpowers")
    || promptLower.includes("super power")
    || promptLower.includes("用superpowers")
    || promptLower.includes("用 superpowers")
    || promptLower.includes("使用superpowers")
    || promptLower.includes("使用 superpowers");
}
