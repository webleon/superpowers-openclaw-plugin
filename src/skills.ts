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
