# OpenClaw Superpowers Plugin

这是一个 OpenClaw 插件，用来桥接上游 [obra/superpowers](https://github.com/obra/superpowers) 工作流 skills。

插件包内只提供一个轻量 OpenClaw bridge skill；真正的上游 Superpowers skills 会在运行时同步到本地 cache。以后更新上游 skills 不需要重新发布插件。

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
          "docsPath": "docs/superpowers",
          "githubToken": "github_pat_xxx"
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
- `sp_update`：同步上游 Superpowers cache 并重新加载 skills。

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
| `githubToken` | string | 未设置 | 可选 GitHub token，用来避免同步上游 skills 时触发匿名 API 限流。 |

更推荐在 OpenClaw gateway 运行环境中设置 `GITHUB_TOKEN` 或 `GH_TOKEN`，而不是把 token 直接写进 `openclaw.json`。

## 工作方式

1. 启动时检查插件目录下的 `.superpowers-cache/`。
2. 如果 cache 不存在，会通过 GitHub 拉取上游 skill 树并把需要的文件落到本地。
3. 从上游 `skills/*/SKILL.md` 加载 skills 到内存。
4. 注册 `sp_skill`、`sp_update`、`sp_status`。
5. 提供精简 prompt guidance，并通过包内 OpenClaw bridge skill 告诉 agent 使用 `sp_skill`。

动态上游 cache 不会写进 `openclaw.plugin.json` 的原生 skills 列表；manifest 里只声明包内 bridge skill。

## 更新上游 Skills

让 assistant 调用 `sp_update`。插件会通过自身的安全同步路径拉取上游 skill 树，并刷新内存中的 skill registry。

如果出现 `403 rate limit exceeded`，请配置 `GITHUB_TOKEN`、`GH_TOKEN`，或者 `plugins.entries.superpowers-openclaw-plugin.config.githubToken`。

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
