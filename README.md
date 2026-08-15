# 个保轻舟 MVP

当前版本：`v0.3.0`

面向小型个人信息处理者的一站式个人信息保护工作台。当前 MVP 已覆盖：

- 企业名称、单位类型、所属行业等基本信息建档与小型处理者路径判断；
- B2B、员工、官网等业务场景登记和简短事实确认；
- 完成业务情况后运行规则与 AI 辅助初步检查，失败时安全降级为本地基础检查；
- 保存每次检查的事实快照、分析版本、发现和历史结论；
- 业务事实修改后自动标记旧检查结果过时；
- 将检查发现一键转为可跟踪的合规待办；
- 通过三步向导建立对外告知、内部要求和内部台账；
- 根据已确认企业和业务事实生成材料草稿，而非只生成通用模板；
- 合规材料版本历史、只读查看、另存新版本与确认发布；
- 官方 24 项合规审计自查表数字化，按六组通俗问题逐项完成；
- 不符合项自动生成整改事项，“不适用”必须说明理由；
- 自查负责人确认、内容哈希冻结和官方顺序打印；
- 按具体业务触发个人信息保护影响评估，保留官方五类情形和三个判断维度；
- 影响评估发现风险或措施不足时自动生成处理事项；
- 影响评估负责人确认、内容哈希冻结和官方格式打印；
- 合规时间线和归档概览。

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

## 接入 AI（不需要 Dify）

系统可以直接调用 DeepSeek、通义千问或 Kimi。只需选择一家并在 `.env.local` 中配置，例如 DeepSeek：

```env
AI_SCENARIO_TRIAGE_PROVIDER=deepseek
AI_SCENARIO_TRIAGE_FALLBACK_PROVIDER=local
DEEPSEEK_API_KEY=请在本地填写
DEEPSEEK_API_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-flash
```

通义千问使用 `DASHSCOPE_API_KEY`，Kimi 使用 `MOONSHOT_API_KEY`。也可以将 `AI_SCENARIO_TRIAGE_PROVIDER` 设为 `auto`，系统会选择已经配置的直连模型。密钥不得提交到代码仓库。

模型接口异常、输出被截断或结构不符合要求时，系统会自动退回基础规则检查。页面统一显示“AI辅助分析”，不会向普通用户暴露模型供应商。

## Dify 作为可选方案

已部署的 Dify 可以继续使用，但不再是必需组件。需要使用时，在 `.env.local` 中配置：

```env
DIFY_API_BASE_URL=https://dify.legalkit.xyz/v1
DIFY_ENABLE=true
DIFY_API_KEY_SCENARIO_TRIAGE=app-请在本地填写
AI_SCENARIO_TRIAGE_PROVIDER=dify
```

Dify 工作流应接受 `enterprise_context`、`scenario_context` 和 `confirmed_facts` 三个字符串输入，并通过 `result` 输出结构化 JSON。如需把 Dify 作为直连模型的备用服务，可设置 `AI_SCENARIO_TRIAGE_FALLBACK_PROVIDER=dify`。

## 校验

```powershell
pnpm typecheck
pnpm test
pnpm build
```

本版本是可试用的业务 MVP，不构成合规认证或正式法律意见。AI 输出、官方自查结论、影响评估和正式材料发布均保留负责人确认点。

## v0.3 使用主链

1. 先在“我的业务”确认实际处理活动；
2. 在“合规自查”按六组通俗问题完成官方 24 项，自查线索仅用于辅助核对；
3. 暂不符合项目会进入“办理事项”，整改完成后回到自查更新结论；
4. 对系统提示或负责人确认触发的业务，在“影响评估”选择适用情形并完成三个判断；
5. 负责人确认后形成只读归档记录，并可按官方顺序打印；
6. 后续业务变化时建立新一期记录，不覆盖历史结论。

## v0.2 使用主链

1. 在“我的业务”完善并确认实际业务情况；
2. 运行“初步检查”，系统自动保存本次事实快照和检查结果；
3. 将需要处理的发现生成待办；
4. 在“合规材料”选择材料用途、关联业务并核对适用对象；
5. 系统生成完整草稿，负责人修改后另存为新版本并确认发布；
6. 业务情况变化后重新检查，并按需更新材料版本。
