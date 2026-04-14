import { getGitStatus, updateSkillsCache } from "./git-cache.ts";
import { deriveActiveSkillLabel, formatActivationLabel } from "./prompt.ts";
import type { ActiveSkillLabel, SkillMatch } from "./prompt.ts";
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

interface ActivationRecord {
  skillName: string;
  activatedAt: string;
  matchedKeywords: string[];
  usedSuperpowersBoost: boolean;
  source: "sp_skill";
}

export interface ToolFactoryInput {
  skills: Map<string, SkillRecord>;
  repoUrl: string;
  githubTokenConfigured: boolean;
  githubToken?: string;
  cacheDir: string;
  getLatestMatches(): SkillMatch[];
  getLastActivation(): ActivationRecord | null;
  getPendingReplyLabel(): ActiveSkillLabel | null;
  setLastActivation(activation: ActivationRecord | null): void;
  setActiveSkill(activeSkill: ActiveSkillLabel | null): void;
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
      const latestMatch = input.getLatestMatches().find((match) => match.name === name);
      const activeSkillLabel = deriveActiveSkillLabel(name, input.getLatestMatches());
      input.setActiveSkill(activeSkillLabel);
      input.setLastActivation({
        skillName: name,
        activatedAt: new Date().toISOString(),
        matchedKeywords: latestMatch?.matchedKeywords ?? [],
        usedSuperpowersBoost: latestMatch?.usedSuperpowersBoost ?? false,
        source: "sp_skill",
      });

      const activationInstructions = activeSkillLabel
        ? [
            "Activation label for the immediate next assistant reply:",
            formatActivationLabel(activeSkillLabel),
            "",
            "Use that exact label as the first line of the same reply after this tool call.",
            "Then output a blank line,",
            "───",
            "another blank line, and continue with the actual answer.",
            "Show the label exactly once and do not send it as a separate message.",
            "",
          ]
        : [];

      return text([
        ...activationInstructions,
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
      const result = await updateSkillsCache(input.cacheDir, input.repoUrl, input.githubToken);
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
      const lastActivation = input.getLastActivation();
      const pendingReplyLabel = input.getPendingReplyLabel();
      return text([
        `Repo: ${input.repoUrl}`,
        `Loaded skills: ${input.skills.size}`,
        `GitHub token configured: ${input.githubTokenConfigured}`,
        `Cache loaded: ${status.loaded}`,
        status.commit ? `Commit: ${status.commit}` : undefined,
        status.date ? `Date: ${status.date}` : undefined,
        `Status: ${status.message}`,
        lastActivation ? `Last activation: ${lastActivation.skillName}` : "Last activation: none",
        lastActivation ? `Activated at: ${lastActivation.activatedAt}` : undefined,
        lastActivation ? `Activation source: ${lastActivation.source}` : undefined,
        lastActivation ? `Matched keywords: ${lastActivation.matchedKeywords.join(", ") || "none"}` : undefined,
        lastActivation ? `Superpowers boost: ${lastActivation.usedSuperpowersBoost}` : undefined,
        pendingReplyLabel ? `Pending reply label: ${pendingReplyLabel.name}` : "Pending reply label: none",
        "Persistent active skill: none",
      ].filter(Boolean).join("\n"));
    },
  };

  return { spSkill, spUpdate, spStatus };
}
