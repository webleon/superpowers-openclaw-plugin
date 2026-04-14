# OpenClaw Superpowers Plugin

OpenClaw plugin that bridges to the upstream [obra/superpowers](https://github.com/obra/superpowers) workflow skills.

The plugin keeps its own lightweight OpenClaw bridge skill in this package and syncs upstream Superpowers skills into a local cache at runtime. Updating the upstream skills does not require republishing the plugin.

## Current Behavior

- Bridges upstream `obra/superpowers` skills into OpenClaw through `sp_skill`, `sp_update`, and `sp_status`.
- Supports natural-language activation such as:
  - `use superpowers to compare a few implementation options`
  - `use superpowers to debug this error`
  - `use superpowers to write a simple execution plan`
- Shows a visible activation label only after a real `sp_skill` activation, for example:

```text
*⚡ brainstorming | 取舍, 方案, superpowers*

───
```

- Keeps `sp_status` as the source of truth for real activation state.
- Returns `sp_status` as a fixed block so the model is less likely to paraphrase it.

## Install

### npm

```bash
openclaw plugins install superpowers-openclaw-plugin
openclaw gateway restart
```

If your OpenClaw install path hits ClawHub rate limits before it falls back cleanly, install from the npm tarball instead:

```bash
npm pack superpowers-openclaw-plugin
openclaw plugins install ~/superpowers-openclaw-plugin-0.1.15.tgz
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

For OpenClaw, the most reliable way is:

```bash
echo 'GITHUB_TOKEN=github_pat_xxx' >> ~/.openclaw/.env
openclaw gateway restart
```

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

## Daily Usage

### Natural-language activation

Examples:

```text
use superpowers to compare a few implementation options
use superpowers to debug this failure and find the root cause first
use superpowers to write a simple execution plan
```

If activation succeeds, the first skill-driven reply should show the activation label at the top.

### Explicit tool usage

Force a specific skill:

```text
Please call sp_skill with name=brainstorming, then help me compare a few implementation options.
```

Inspect current status:

```text
Please call sp_status and output the status block verbatim.
```

Update the upstream cache:

```text
Please call sp_update and tell me the new cache commit.
```

### `sp_status` fixed block

Expected format:

```text
[SP_STATUS_BEGIN]
repo=https://github.com/obra/superpowers.git
loaded_skills=14
github_token_configured=true
cache_loaded=true
cache_commit=917e5f5
cache_date=2026-04-06T22:48:58Z
cache_status=Skills cache at 917e5f5
last_activation=brainstorming
activated_at=2026-04-14T11:18:05.666Z
activation_source=sp_skill
matched_keywords=取舍,方案
superpowers_boost=true
pending_reply_label=none
persistent_active_skill=none
[SP_STATUS_END]
```

Interpretation:

- `last_activation` is the most recent real `sp_skill` success.
- `pending_reply_label` is the one-shot label waiting to be consumed by the next normal reply.
- `persistent_active_skill` should normally stay `none`; the plugin does not keep a long-running active mode.

## Recommended Debug Flow

When activation looks suspicious, use this order:

1. Send the natural-language request.
2. Check whether the visible activation label appeared.
3. Immediately ask for:

```text
Please call sp_status and output the status block verbatim.
```

4. Verify:
   - `last_activation=<expected skill>`
   - `activation_source=sp_skill`
   - `matched_keywords=<expected triggers>`

If there is no activation label but `last_activation` changed, activation succeeded and only the label display failed.

## Troubleshooting

### `403 rate limit exceeded`

Configure one of:
- `GITHUB_TOKEN`
- `GH_TOKEN`
- `plugins.entries.superpowers-openclaw-plugin.config.githubToken`

### `Timed out waiting for skills cache lock`

This was fixed by the stale-lock recovery logic in newer releases. Upgrade to the latest package first.

If an older install is still stuck:

```bash
rm -rf ~/.openclaw/extensions/superpowers-openclaw-plugin/.superpowers-cache/.sync-lock
rm -rf ~/.openclaw/extensions/superpowers-openclaw-plugin/.superpowers-cache/skills.next-*
openclaw gateway restart
```

### Plugin installed but not loaded

Use:

```bash
openclaw plugins list --verbose
openclaw plugins inspect superpowers-openclaw-plugin
```

If needed, reinstall cleanly:

```bash
rm -rf ~/.openclaw/extensions/superpowers-openclaw-plugin
npm pack superpowers-openclaw-plugin
openclaw plugins install ~/superpowers-openclaw-plugin-0.1.15.tgz
openclaw gateway restart
```

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

- Plugin repository: [webleon/superpowers-openclaw-plugin](https://github.com/webleon/superpowers-openclaw-plugin)
- Upstream Superpowers: [obra/superpowers](https://github.com/obra/superpowers)
- npm package: [superpowers-openclaw-plugin](https://www.npmjs.com/package/superpowers-openclaw-plugin)
