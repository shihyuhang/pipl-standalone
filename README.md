# 个保轻舟 MVP

当前版本：`v0.2.0`

面向小型个人信息处理者的一站式个人信息保护工作台。当前 MVP 已覆盖：

- 企业快速建档与小型处理者路径判断；
- B2B、员工、官网等业务场景登记和简短事实确认；
- 完成业务情况后运行云端 Dify 初步检查，失败时安全降级为本地基础检查；
- 保存每次检查的事实快照、Dify 运行来源、发现和历史结论；
- 业务事实修改后自动标记旧检查结果过时；
- 将检查发现一键转为可跟踪的合规待办；
- 通过三步向导建立对外告知、内部要求和内部台账；
- 根据已确认企业和业务事实生成材料草稿，而非只生成通用模板；
- 合规材料版本历史、只读查看、另存新版本与确认发布；
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

## v0.2 使用主链

1. 在“我的业务”完善并确认实际业务情况；
2. 运行“初步检查”，系统自动保存本次事实快照和检查结果；
3. 将需要处理的发现生成待办；
4. 在“合规材料”选择材料用途、关联业务并核对适用对象；
5. 系统生成完整草稿，负责人修改后另存为新版本并确认发布；
6. 业务情况变化后重新检查，并按需更新材料版本。
