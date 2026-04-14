# OpenClaw Superpowers Plugin Design

Date: 2026-04-14

## Goal

Turn the existing `vruru/superpowers-bridge` fork into `openclaw-superpowers-plugin`, a maintainable OpenClaw plugin owned from `https://github.com/webleon/superpowers-openclaw-plugin`.

The plugin should make `obra/superpowers` workflows available inside OpenClaw conversations and allow the local skill cache to be updated later without republishing the plugin.

## Chosen Distribution Model

The plugin will be source-install-first and npm-ready:

- Primary development and testing path: install from the local clone or GitHub fork.
- Public distribution path: publish the same code as the existing npm package `openclaw-superpowers-plugin`.
- The package name, repository URL, README examples, and manifest metadata will use the user's fork and npm package, not `@vruru/superpowers-bridge`.

This keeps local iteration simple while avoiding a later restructure before npm publishing.

## OpenClaw Compatibility

The implementation will follow the current OpenClaw native plugin shape:

- Keep `openclaw.plugin.json` as the native plugin manifest and configuration schema.
- Declare `contracts.tools` for the owned agent tools: `sp_skill`, `sp_update`, and `sp_status`.
- Ship a small static OpenClaw bridge skill under `skills/` and list it in manifest `skills`, so OpenClaw's native skill loader can teach agents to use `sp_skill` even when prompt hooks are disabled.
- Keep `package.json.openclaw.extensions` as the extension entry declaration for npm and package installs.
- Add explicit package `openclaw.compat` and `openclaw.build` metadata for the minimum OpenClaw API used by the plugin.
- Add `openclaw.install` metadata with `npmSpec: "openclaw-superpowers-plugin"` and a local development path hint.
- Use `definePluginEntry` from `openclaw/plugin-sdk/plugin-entry`.
- Move all SDK imports to focused OpenClaw plugin SDK paths recommended by current documentation.
- Replace legacy `before_agent_start` prompt mutation with `before_prompt_build`, while keeping a small compatibility fallback only if needed for older hosts.

The implementation should fail clearly when the OpenClaw runtime does not provide a required tool API. Prompt injection should degrade gracefully when the host disables prompt mutation hooks for this plugin.

## Skill Source And Cache

The plugin will not vendor `obra/superpowers` into the npm package.

Instead, it will maintain a local Git cache:

- Default source repository: `https://github.com/obra/superpowers.git`.
- Configurable through `skillsRepo`.
- Cloned on first use when the cache is missing.
- Updated through an explicit `sp_update` tool.
- Optional startup update through `autoUpdate`, defaulting to `false`.

The cache path should be stable for each plugin installation and ignored by Git/package publishing.

Do not list the dynamic upstream cache in `openclaw.plugin.json.skills`. The manifest is read before runtime code executes, so only the packaged bridge skill belongs there. Runtime-fetched upstream skills remain available through `sp_skill`.

## Runtime Behavior

At startup, the plugin will:

1. Read plugin config.
2. Ensure the Superpowers repo cache exists, unless startup cloning fails.
3. Load `skills/*/SKILL.md` files from the cache.
4. Register tools for skill lookup, updates, and version inspection.
5. Add compact system guidance during prompt build when the OpenClaw hook is available.

OpenClaw snapshots eligible native skills at session start. The packaged bridge skill follows that lifecycle. Runtime updates from `sp_update` should reload the plugin's in-memory upstream skill registry immediately, but any packaged bridge skill change still requires a new OpenClaw session or normal skills watcher refresh.

The prompt injection should be compact by default:

- Always advertise that Superpowers skills are available.
- Include `using-superpowers` guidance when present.
- Include a concise list of available skills and descriptions.
- Include selected full skill content only when auto-detection confidently matches the user's prompt.
- Explicitly say that `sp_skill` is the OpenClaw equivalent of invoking a Superpowers skill.

The `sp_skill` tool remains the main path for loading full skill content on demand.

## Tools

The plugin will expose three tools:

- `sp_skill`: accepts a skill name and returns the full `SKILL.md` content, parsed metadata, the skill path, and any directly referenced companion files when requested.
- `sp_update`: pulls the latest upstream skills, reloads the in-memory skill registry, and returns the update result.
- `sp_status`: returns the cached upstream commit, date, repository URL, and loaded skill count.

Tool results should be structured enough for an assistant to explain failures and continue when possible.

Tool implementations should follow the current OpenClaw tool contract: `execute(_id, params)` and return `{ content: [{ type: "text", text: "..." }] }` for assistant-visible text, with structured details included in text or documented fields only where the SDK supports them.

## Configuration

The config schema will include:

- `skillsRepo`: Git URL for the Superpowers source repository.
- `autoDetectCode`: enables automatic skill selection from prompt content.
- `autoUpdate`: updates the skill cache when the plugin starts.
- `docsPath`: default location for Superpowers design documents.

Plugin enable/disable should use OpenClaw's wrapper config, `plugins.entries.<id>.enabled`, not a duplicated `enabled` field inside `plugins.entries.<id>.config`.

Defaults should favor predictable startup:

- `skillsRepo`: `https://github.com/obra/superpowers.git`
- `autoDetectCode`: `true`
- `autoUpdate`: `false`
- `docsPath`: `docs/superpowers`

## Code Structure

The refactor should create clear internal boundaries:

- Config/default handling.
- Git cache management.
- Skill parsing/loading.
- Skill selection and prompt context building.
- Static bridge skill content.
- OpenClaw plugin registration.

Split these into `src/` modules rather than keeping all behavior in `index.ts`. Keep the OpenClaw entry thin and use local module imports instead of importing this plugin through any generated SDK path.

## Error Handling

The plugin should degrade rather than crash OpenClaw:

- If `git clone` fails, log the failure and register tools that report the cache is unavailable.
- If a single skill file cannot be parsed, skip that skill and log a warning.
- If `git pull` fails, keep the previous loaded skill registry.
- If no skills are loaded, inject no skill-specific context and make `sp_skill` return a clear available-skills error.

Shell execution must avoid interpolating untrusted values into command strings where possible. Prefer `spawnSync` or `execFileSync` with argument arrays for `git` commands.

## Testing And Verification

Add lightweight verification that can run without OpenClaw:

- Unit-test or script-test skill frontmatter parsing.
- Test skill directory loading from a fixture.
- Test prompt context construction for no-match and matched-skill cases.
- Test package metadata consistency between `package.json` and `openclaw.plugin.json`.

Manual verification should include:

- Local source install path.
- `sp_skill` tool lookup.
- `sp_status` result after cache clone.
- `sp_update` reload behavior.
- npm package dry run with `npm pack --dry-run`.

## Documentation

README files should be updated to describe:

- Source install from `webleon/superpowers-openclaw-plugin`.
- npm install through `openclaw-superpowers-plugin`.
- Configuration options.
- How to update the upstream Superpowers skills.
- How to publish a new npm version.

The docs should avoid implying ownership of `obra/superpowers`; the plugin is a bridge that consumes that upstream project.

## Non-Goals

- Do not reimplement Superpowers skills in this plugin.
- Do not publish under `@vruru/superpowers-bridge`.
- Do not require users to manually copy skills into the package.
- Do not enable automatic upstream updates by default.
- Do not add a separate server process unless OpenClaw requires it.

## References Checked

- OpenClaw plugin building docs: `https://docs.openclaw.ai/plugins/building-plugins`
- OpenClaw manifest docs: `https://docs.openclaw.ai/plugins/manifest`
- OpenClaw skills docs: `https://docs.openclaw.ai/skills`
- OpenClaw system prompt docs: `https://docs.openclaw.ai/concepts/system-prompt`
- Upstream Superpowers repo: `https://github.com/obra/superpowers`, checked at `917e5f53b16b115b70a3a355ed5f4993b9f8b73d` from 2026-04-06
