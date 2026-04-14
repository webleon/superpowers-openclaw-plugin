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
      const result = await updateSkillsCache(input.cacheDir, input.repoUrl);
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
