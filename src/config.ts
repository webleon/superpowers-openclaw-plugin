export interface PluginConfig {
  skillsRepo: string;
  docsPath: string;
  autoDetectCode: boolean;
  autoUpdate: boolean;
  githubToken?: string;
}

export const DEFAULT_CONFIG: PluginConfig = {
  skillsRepo: "https://github.com/obra/superpowers.git",
  docsPath: "docs/superpowers",
  autoDetectCode: true,
  autoUpdate: false,
  githubToken: undefined,
};

export function normalizeConfig(input: Partial<PluginConfig> = {}): PluginConfig {
  return {
    skillsRepo: typeof input.skillsRepo === "string" && input.skillsRepo.length > 0
      ? input.skillsRepo
      : DEFAULT_CONFIG.skillsRepo,
    docsPath: typeof input.docsPath === "string" && input.docsPath.length > 0
      ? input.docsPath
      : DEFAULT_CONFIG.docsPath,
    autoDetectCode: input.autoDetectCode ?? DEFAULT_CONFIG.autoDetectCode,
    autoUpdate: input.autoUpdate ?? DEFAULT_CONFIG.autoUpdate,
    githubToken: typeof input.githubToken === "string" && input.githubToken.length > 0
      ? input.githubToken
      : process.env.GITHUB_TOKEN || process.env.GH_TOKEN || DEFAULT_CONFIG.githubToken,
  };
}
