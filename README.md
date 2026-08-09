# 个保轻舟 MVP

当前版本：`v0.1.0`

面向小型个人信息处理者的一站式个人信息保护工作台。当前 MVP 已覆盖：

- 企业快速建档与小型处理者路径判断；
- B2B、员工、官网等业务场景登记和简短事实确认；
- 完成业务情况后运行云端 Dify 场景分流，失败时安全降级为本地基础检查；
- 合规待办闭环；
- 隐私声明草稿、版本历史与确认发布；
- 基础合规时间线和打印。

## 本地运行（不需要 Docker）

### Windows CMD 一键启动

在项目目录中运行：

```cmd
start-mvp.cmd
```

脚本会自动寻找当前工作区可用的 Node.js、创建 `.env.local` 并启动系统。

### PowerShell / 已安装 pnpm 的环境

```powershell
pnpm install
Copy-Item .env.example .env.local
pnpm dev
```

如果使用 Windows CMD，复制文件的命令是：

```cmd
copy .env.example .env.local
```

打开 `http://localhost:3000`。默认使用 Node 内置 SQLite，数据保存在 `data/pipl-mvp.db`。

## 可选接入 Dify

不配置 Dify 时系统会使用确定性规则完成基础检查，但界面不会将其表述为 AI 分流结论。需要接入时，在 `.env.local` 中配置：

```env
DIFY_API_BASE_URL=https://dify.legalkit.xyz/v1
DIFY_ENABLE=true
DIFY_API_KEY_SCENARIO_TRIAGE=app-请在本地填写
```

密钥不得提交到代码仓库。Dify 工作流应接受 `enterprise_context`、`scenario_context` 和 `confirmed_facts` 三个字符串输入，并通过 `result` 输出结构化 JSON。

## 校验

```powershell
pnpm typecheck
pnpm test
pnpm build
```

本版本是可试用的业务 MVP，不构成合规认证或正式法律意见。AI 输出和正式材料发布均保留人工确认点。
