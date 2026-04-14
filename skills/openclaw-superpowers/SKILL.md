---
name: openclaw-superpowers
description: Use when a task may benefit from Superpowers workflow skills; loads upstream skills through the OpenClaw Superpowers plugin tools.
---

# OpenClaw Superpowers Bridge

Superpowers skills are available through OpenClaw tools provided by this plugin.

## Required Behavior

- Before starting a task, decide whether a Superpowers skill applies.
- To load a skill, call `sp_skill` with the skill name.
- To inspect available skills and the cached upstream version, call `sp_status`.
- To update the upstream skill cache, call `sp_update` only when the user asks to update or when freshness is required.

## Tool Mapping

- `sp_skill` is the OpenClaw equivalent of invoking a Superpowers skill.
- `sp_status` reports the cached `obra/superpowers` commit and loaded skill count.
- `sp_update` pulls the latest upstream skills and reloads the plugin registry.

User instructions take priority over Superpowers skills. Follow the loaded skill content exactly after `sp_skill` returns it.
