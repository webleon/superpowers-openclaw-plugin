# OpenClaw Superpowers Plugin

这是一个 OpenClaw 插件，用来桥接上游 [obra/superpowers](https://github.com/obra/superpowers) 工作流 skills。

插件包内只提供一个轻量 OpenClaw bridge skill；真正的上游 Superpowers skills 会在运行时同步到本地 cache。以后更新上游 skills 不需要重新发布插件。

## 当前能力

- 通过 `sp_skill`、`sp_update`、`sp_status` 把上游 `obra/superpowers` skills 桥接到 OpenClaw。
- 支持自然语言或类自然语言激活，例如：
  - `用 superpowers 帮我比较几个实现方案`
  - `用 superpowers 帮我排查这个报错`
  - `用 superpowers 帮我写一个简单的执行方案`
- 真实激活后，会在第一条 skill 驱动回复顶部显示激活标签，例如：

```text
*⚡ brainstorming | 取舍, 方案, superpowers*

───
```

- `sp_status` 是真实激活状态的权威来源。
- `sp_status` 现在会返回固定状态块，减少被模型自由改写的概率。

## 安装

### npm

```bash
openclaw plugins install superpowers-openclaw-plugin
openclaw gateway restart
```

如果你的 OpenClaw 安装过程先命中 ClawHub 限流，最稳的是先拿 npm tarball 再安装：

```bash
npm pack superpowers-openclaw-plugin
openclaw plugins install ~/superpowers-openclaw-plugin-0.1.15.tgz
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

对 OpenClaw 来说，最稳的做法是写到：

```bash
echo 'GITHUB_TOKEN=github_pat_xxx' >> ~/.openclaw/.env
openclaw gateway restart
```

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

## 日常使用

### 自然语言激活

示例：

```text
用 superpowers 帮我比较几个实现方案
用 superpowers 帮我排查这个报错，先定位根因
用 superpowers 帮我写一个简单的执行方案
```

如果真实激活成功，第一条 skill 驱动回复顶部应出现激活标签。

### 显式工具调用

强制加载某个 skill：

```text
请先调用 sp_skill 加载 brainstorming，然后再帮我比较几个实现方案。
```

查看状态：

```text
请调用 sp_status，原样输出状态块，不要解释。
```

更新上游 cache：

```text
请调用 sp_update，并告诉我新的 cache commit。
```

### `sp_status` 固定状态块

返回格式示例：

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

字段语义：

- `last_activation`：最近一次真实 `sp_skill` 成功事件
- `pending_reply_label`：下一条正常回复待消费的一次性标签
- `persistent_active_skill`：通常应保持 `none`，插件不维持持久模式

## 推荐调试流程

当你怀疑“有没有真的激活”时，按这个顺序判断：

1. 先发自然语言业务请求
2. 看是否出现顶部激活标签
3. 立刻再发：

```text
请调用 sp_status，原样输出状态块，不要解释。
```

4. 核对：
   - `last_activation=<预期 skill>`
   - `activation_source=sp_skill`
   - `matched_keywords=<预期触发词>`

如果没有顶部标签，但 `last_activation` 变了，说明真实激活成功，只是标签显示链路漏了。

## 排障

### `403 rate limit exceeded`

请配置：
- `GITHUB_TOKEN`
- `GH_TOKEN`
- 或 `plugins.entries.superpowers-openclaw-plugin.config.githubToken`

### `Timed out waiting for skills cache lock`

较新版本已经包含 stale lock 自愈逻辑。先升级到最新版。

如果旧安装仍然卡住，可以手动清理：

```bash
rm -rf ~/.openclaw/extensions/superpowers-openclaw-plugin/.superpowers-cache/.sync-lock
rm -rf ~/.openclaw/extensions/superpowers-openclaw-plugin/.superpowers-cache/skills.next-*
openclaw gateway restart
```

### 插件装了但没加载

执行：

```bash
openclaw plugins list --verbose
openclaw plugins inspect superpowers-openclaw-plugin
```

必要时做一次干净重装：

```bash
rm -rf ~/.openclaw/extensions/superpowers-openclaw-plugin
npm pack superpowers-openclaw-plugin
openclaw plugins install ~/superpowers-openclaw-plugin-0.1.15.tgz
openclaw gateway restart
```

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

- 插件仓库：[webleon/superpowers-openclaw-plugin](https://github.com/webleon/superpowers-openclaw-plugin)
- 上游 Superpowers：[obra/superpowers](https://github.com/obra/superpowers)
- npm 包：[superpowers-openclaw-plugin](https://www.npmjs.com/package/superpowers-openclaw-plugin)
