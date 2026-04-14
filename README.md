# OpenClaw Superpowers Plugin

OpenClaw plugin that bridges to the upstream [obra/superpowers](https://github.com/obra/superpowers) workflow skills.

The plugin keeps its own lightweight OpenClaw bridge skill in this package and syncs upstream Superpowers skills into a local cache at runtime. Updating the upstream skills does not require republishing the plugin.

## Install

### npm

```bash
openclaw plugins install superpowers-openclaw-plugin
openclaw gateway restart
```

### Local source

```bash
cd ~/.openclaw/workspace/plugins
git clone https://github.com/webleon/superpowers-openclaw-plugin.git
openclaw plugins install ./superpowers-openclaw-plugin
openclaw gateway restart
```

Enable or configure it in `~/.openclaw/openclaw.json`:

```json
{
  "plugins": {
    "entries": {
      "superpowers-openclaw-plugin": {
        "enabled": true,
        "config": {
          "autoDetectCode": true,
          "autoUpdate": false,
          "skillsRepo": "https://github.com/obra/superpowers.git",
          "docsPath": "docs/superpowers",
          "githubToken": "github_pat_xxx"
        }
      }
    }
  }
}
```

The plugin-level `enabled` flag belongs on `plugins.entries.superpowers-openclaw-plugin.enabled`; it is not duplicated inside `config`.

## Tools

- `sp_skill`: load a specific upstream Superpowers `SKILL.md` by name.
- `sp_status`: show cache status, loaded skill count, upstream repo, and commit info.
- `sp_update`: sync the upstream Superpowers cache and reload skills.

Example:

```json
{
  "name": "brainstorming"
}
```

Use that payload with `sp_skill`.

## Configuration

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `skillsRepo` | string | `https://github.com/obra/superpowers.git` | Upstream Superpowers Git repository. |
| `autoDetectCode` | boolean | `true` | Adds compact Superpowers context for matching prompts. |
| `autoUpdate` | boolean | `false` | Pulls upstream skills when the plugin starts. Keep disabled for predictable startup. |
| `docsPath` | string | `docs/superpowers` | Default path used by Superpowers planning workflows. |
| `githubToken` | string | unset | Optional GitHub token used to avoid anonymous rate limits while syncing upstream skills. |

Prefer setting `GITHUB_TOKEN` or `GH_TOKEN` in the OpenClaw gateway environment instead of writing a token into `openclaw.json`.

## How It Works

1. On startup, the plugin checks `.superpowers-cache/` under the plugin directory.
2. If missing, it fetches the upstream skill tree from GitHub and stores the needed files locally.
3. It loads upstream `skills/*/SKILL.md` files into memory.
4. It registers `sp_skill`, `sp_update`, and `sp_status`.
5. It provides compact prompt guidance and a packaged OpenClaw bridge skill that tells agents to use `sp_skill`.

The dynamic upstream cache is not listed as OpenClaw native skills in `openclaw.plugin.json`; only the packaged bridge skill is listed there.

## Update Upstream Skills

Ask the assistant to call `sp_update`. That syncs the upstream skill tree through the plugin's safe update path and refreshes the in-memory registry.

If sync fails with `403 rate limit exceeded`, configure `GITHUB_TOKEN`, `GH_TOKEN`, or `plugins.entries.superpowers-openclaw-plugin.config.githubToken`.

## Development

```bash
npm test
npm run pack:dry-run
```

Before publishing a new version:

```bash
npm test
npm run pack:dry-run
npm publish
```

## Links

- Plugin repository: https://github.com/webleon/superpowers-openclaw-plugin
- Upstream Superpowers: https://github.com/obra/superpowers
- npm package: https://www.npmjs.com/package/superpowers-openclaw-plugin
