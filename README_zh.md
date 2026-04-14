# OpenClaw Superpowers Plugin

这是一个 OpenClaw 插件，用来桥接上游 [obra/superpowers](https://github.com/obra/superpowers) 工作流 skills。

插件包内只提供一个轻量 OpenClaw bridge skill；真正的上游 Superpowers skills 会在运行时下载到本地 Git cache。以后更新上游 skills 不需要重新发布插件。

## 安装

### npm

```bash
openclaw plugins install superpowers-openclaw-plugin
openclaw gateway restart
```

### 本地源码

```bash
cd ~/.openclaw/workspace/plugins
git clone https://github.com/webleon/superpowers-openclaw-plugin.git
openclaw plugins install ./superpowers-openclaw-plugin
openclaw gateway restart
```

在 `~/.openclaw/openclaw.json` 中启用或配置：

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
          "docsPath": "docs/superpowers"
        }
      }
    }
  }
}
```

插件启用开关使用 `plugins.entries.superpowers-openclaw-plugin.enabled`；不要在 `config` 里再放一个 `enabled`。

## 工具

- `sp_skill`：按名称加载上游 Superpowers `SKILL.md`。
- `sp_status`：查看 cache 状态、已加载 skill 数量、上游仓库和 commit。
- `sp_update`：对上游 Superpowers cache 执行 `git pull --ff-only` 并重新加载 skills。

示例：

```json
{
  "name": "brainstorming"
}
```

把这个 payload 传给 `sp_skill`。

## 配置

| 选项 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `skillsRepo` | string | `https://github.com/obra/superpowers.git` | 上游 Superpowers Git 仓库。 |
| `autoDetectCode` | boolean | `true` | 根据 prompt 匹配并注入精简 Superpowers 上下文。 |
| `autoUpdate` | boolean | `false` | 插件启动时拉取上游 skills。为了启动稳定，默认关闭。 |
| `docsPath` | string | `docs/superpowers` | Superpowers 计划/设计流程使用的默认文档路径。 |

## 工作方式

1. 启动时检查插件目录下的 `.superpowers-cache/`。
2. 如果 cache 不存在，clone `https://github.com/obra/superpowers.git`。
3. 从上游 `skills/*/SKILL.md` 加载 skills 到内存。
4. 注册 `sp_skill`、`sp_update`、`sp_status`。
5. 提供精简 prompt guidance，并通过包内 OpenClaw bridge skill 告诉 agent 使用 `sp_skill`。

动态上游 cache 不会写进 `openclaw.plugin.json` 的原生 skills 列表；manifest 里只声明包内 bridge skill。

## 更新上游 Skills

让 assistant 调用 `sp_update`，或在 cache 目录手动运行：

```bash
cd ~/.openclaw/workspace/plugins/superpowers-openclaw-plugin/.superpowers-cache
git pull --ff-only
```

如果需要新的 session skill 快照，更新后重启 OpenClaw。

## 开发

```bash
npm test
npm run pack:dry-run
```

发布新版本前：

```bash
npm test
npm run pack:dry-run
npm publish
```

## 链接

- 插件仓库：https://github.com/webleon/superpowers-openclaw-plugin
- 上游 Superpowers：https://github.com/obra/superpowers
- npm 包：https://www.npmjs.com/package/superpowers-openclaw-plugin
