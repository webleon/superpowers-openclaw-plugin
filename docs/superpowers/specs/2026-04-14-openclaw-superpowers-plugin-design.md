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
- Keep `package.json.openclaw.extensions` as the extension entry declaration for npm and package installs.
- Move SDK imports to the focused OpenClaw plugin SDK paths recommended by current documentation where the installed SDK supports them.
- Replace legacy hook usage with the current prompt/system-context hook model, while keeping a small compatibility fallback if needed.

The implementation should fail clearly when the OpenClaw runtime does not provide a required hook or tool API.

## Skill Source And Cache

The plugin will not vendor `obra/superpowers` into the npm package.

Instead, it will maintain a local Git cache:

- Default source repository: `https://github.com/obra/superpowers.git`.
- Configurable through `skillsRepo`.
- Cloned on first use when the cache is missing.
- Updated through an explicit `sp_update` tool.
- Optional startup update through `autoUpdate`, defaulting to `false`.

The cache path should be stable for each plugin installation and ignored by Git/package publishing.

## Runtime Behavior

At startup, the plugin will:

1. Read plugin config.
2. Ensure the Superpowers repo cache exists, unless startup cloning fails.
3. Load `skills/*/SKILL.md` files from the cache.
4. Register tools for skill lookup, updates, and version inspection.
5. Add compact system guidance before the agent starts or before the prompt is built, depending on the OpenClaw hook available.

The prompt injection should be compact by default:

- Always advertise that Superpowers skills are available.
- Include `using-superpowers` guidance when present.
- Include a concise list of available skills and descriptions.
- Include selected full skill content only when auto-detection confidently matches the user's prompt.

The `sp_skill` tool remains the main path for loading full skill content on demand.

## Tools

The plugin will expose three tools:

- `sp_skill`: accepts a skill name and returns the full skill body plus metadata.
- `sp_update`: pulls the latest upstream skills, reloads the in-memory skill registry, and returns the update result.
- `sp_status`: returns the cached upstream commit, date, repository URL, and loaded skill count.

Tool results should be structured enough for an assistant to explain failures and continue when possible.

## Configuration

The config schema will include:

- `enabled`: enables or disables the plugin.
- `skillsRepo`: Git URL for the Superpowers source repository.
- `autoDetectCode`: enables automatic skill selection from prompt content.
- `autoUpdate`: updates the skill cache when the plugin starts.
- `docsPath`: default location for Superpowers design documents.

Defaults should favor predictable startup:

- `enabled`: `true`
- `skillsRepo`: `https://github.com/obra/superpowers.git`
- `autoDetectCode`: `true`
- `autoUpdate`: `false`
- `docsPath`: `docs/superpowers`

## Code Structure

The single-file implementation can remain acceptable for a small plugin, but the refactor should create clearer internal boundaries:

- Config/default handling.
- Git cache management.
- Skill parsing/loading.
- Skill selection and prompt context building.
- OpenClaw plugin registration.

If the file becomes hard to test or review, split these into `src/` modules and keep the OpenClaw entry thin.

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
