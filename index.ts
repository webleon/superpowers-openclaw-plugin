import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import { normalizeConfig } from "./src/config.ts";
import { ensureSkillsCache, getCachePaths, updateSkillsCache } from "./src/git-cache.ts";
import { buildPromptContext, detectRelevantSkills } from "./src/prompt.ts";
import { loadSkills } from "./src/skills.ts";
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
