# Dify 工作流设计与提示词包 V1.0

> 状态：开发基线草案  
> 服务对象：中国境内小型个人信息处理者  
> 配套文件：`dify/workflow-registry.v1.json`、`dify/prompts/*.md`、`schemas/ai/*.schema.json`  
> 约束：不把 Dify 建成第二套业务系统，不把 AI 草稿当作正式合规结论

## 1. 本版结论

Dify 在本平台中承担“受控的语义工作流编排”，不是所有任务的默认执行器。

只有同时满足以下至少一个条件时，才考虑调用 Dify：

- 需要从自由文本或企业文档中理解业务事实；
- 需要检索官方资料并保留召回片段；
- 需要比较法律要求、企业事实、企业文本和新场景；
- 需要动态生成补充问题；
- 需要生成结构化评估草稿、整改建议或文档草稿；
- 需要在通义千问、Kimi、DeepSeek 之间开展同一工作流的对照评测。

以下任务始终由主平台完成：

- 人数阈值、官方枚举、状态、期限和硬规则；
- 租户、用户、权限、幂等、审批、签名和证据；
- 固定问题与事实的直接映射；
- 资格正式结论、官方表正式结论和整改验收；
- 隐私声明的版本批准、发布、替代和公开；
- AI Schema 最终验证和正式对象落库。

这与 Dify 的当前能力边界相符：Dify Workflow 提供 LLM、结构化输出、IF/ELSE、Iteration、Knowledge Retrieval、Tool/HTTP、Output 和运行日志等编排能力；服务 API 支持运行与查询工作流，并要求 API Key 保存在服务端。[Dify Workflow 快速指南](https://docs.dify.ai/en/guides/application-orchestrate/creating-an-application)、[Workflow API 指南](https://docs.dify.ai/en/api-reference/guides/workflow)、[工作流日志](https://docs.dify.ai/api-reference/workflows/list-workflow-logs)

## 2. 一个重要调整：首期不使用 Dify Human Input

Dify 已提供 Human Input 节点、暂停状态和恢复事件流。[Human Input API 流程](https://docs.dify.ai/en/api-reference/guides/human-input-flow)、[工作流事件流](https://docs.dify.ai/api-reference/chatflows/stream-workflow-events)

但首期仍不使用该节点，原因是：

1. 企业可能几小时或几天后才回答，长会话应由主平台稳定保存；
2. 每个问题、答案、修改和事实确认都要进入平台证据链；
3. 同一事实需要在不同工作流间复用；
4. Dify 工作流升级或迁移不应影响未完成会话；
5. 用户不直接接触 Dify 页面。

正确流程是：

```mermaid
flowchart LR
    A["主平台创建评估会话"] --> B["AI Gateway 启动一次 Dify 运行"]
    B --> C{"信息是否充分"}
    C -- "不足" --> D["返回候选问题"]
    D --> E["主平台保存问题和答案"]
    E --> B
    C -- "充分" --> F["返回评估或文档草稿"]
    F --> G["Schema 校验、规则复核、人工确认"]
```

每次 Dify 运行都是短任务，不承担长期会话状态。

## 3. 运行拓扑

```mermaid
flowchart TB
    UI["平台页面"] --> CORE["主业务系统"]
    CORE --> RULE["规则引擎"]
    CORE --> AIGW["AI Gateway"]
    AIGW --> MIN["最小化与脱敏"]
    MIN --> DIRECT["直接模型调用"]
    MIN --> DIFY["Dify Workflow"]
    DIFY --> KB["共享官方知识库"]
    DIFY --> MODEL["已绑定模型"]
    DIFY --> VALIDATE["只读输出校验工具"]
    VALIDATE --> AIGW
    AIGW --> CORE
```

### 3.1 主平台到 AI Gateway

使用 `/internal/v1/ai-runs`。主平台传入租户 ID、任务对象引用和模型策略，AI Gateway 完成权限、配额、输入 manifest、最小化和脱敏。

### 3.2 AI Gateway 到 Dify

使用 `ai-workflow-request.v1.schema.json`。送入 Dify 的请求不包含持久租户 ID，只包含：

- 一次性 `run_id`；
- 仅本次有效的 `workspace_token`；
- 工作流和 Prompt 版本；
- 已最小化的事实、规则结果和企业文本片段；
- 官方法规片段或受控检索条件；
- 输出 Schema 和模型能力策略。

### 3.3 Dify 返回 AI Gateway

使用 `ai-workflow-response.v1.schema.json`。返回状态只有：

- `needs_input`；
- `draft_ready`；
- `needs_review`；
- `failed`。

不存在 `approved`、`signed`、`published` 或整体合规认证状态。

## 4. Dify 输入变量

为降低 Dify 版本和开始节点字段类型差异，首期服务 API 只提交三个顶层输入：

| 变量 | 类型 | 说明 |
|---|---|---|
| `payload_json` | 长文本 | 经 AI Gateway 校验并序列化的 AI Request |
| `validation_token` | Secret/文本 | 仅允许调用本次输出校验，不进入 LLM Prompt |
| `trace_id` | 短文本 | 链路追踪，不含租户信息 |

第一个 Code 节点解析 `payload_json`，并明确拆分：

- `model_context_json`：可以进入模型；
- `retrieval_config`：只进入知识检索节点；
- `validation_context`：只进入输出校验工具；
- `workspace_token`：不得进入模型 Prompt。

Code 节点只做 JSON 解析、字段选择、数组分批和确定性合并，不实现法律判断，也不访问网络或数据库。

## 5. 知识检索设计

### 5.1 首期知识范围

Dify 知识库只保存所有企业共享的官方资料：

- 法律、行政法规和部门规定；
- 小型处理者专项规定；
- 官方附件；
- 官方答记者问和解释。

企业隐私声明、员工制度、合同和业务材料不进入共享知识库。它们由主平台按 `tenant_id` 校验后切成任务所需片段，再通过 `document_excerpts` 传入。

### 5.2 分块和元数据

法规按照“条—款—项”或完整官方表项目切分，不能机械按固定字数割裂条件和例外。每个片段至少有：

| 字段 | 用途 |
|---|---|
| `source_code` | 稳定来源编码 |
| `source_type` | law、official_rule、official_form 等 |
| `article_locator` | 条、款、项或表格项目 |
| `topic_tags` | 告知、同意、敏感信息、跨境等 |
| `official_item_codes` | A01—A24、P01—P05 |
| `content_hash` | 原文一致性 |
| `official_url` | 回溯来源 |

Dify 提供知识库、元数据管理和检索测试接口，可以支持这种受控检索和上线前召回测试。[Knowledge API](https://docs.dify.ai/en/api-reference/guides/knowledge)、[检索测试接口](https://docs.dify.ai/en/api-reference/knowledge-bases/retrieve-chunks-from-a-knowledge-base-test-retrieval)、[文档元数据](https://docs.dify.ai/en/cloud/use-dify/knowledge/metadata)

### 5.3 三种模式

- `none`：不需要法规检索；
- `preassembled`：AI Gateway 已传入精确法规片段；
- `dify_knowledge`：Dify Knowledge Retrieval 使用 source/topic 元数据过滤。

首期默认 `top_k=10`，上限 20；是否开启 rerank、最低分和最终 top_k 以检索金标评测为准。Dify 模型插件接口也支持 embedding 和 rerank 类型，便于后续替换。[Dify 模型接口](https://docs.dify.ai/en/develop-plugin/features-and-specs/plugin-types/model-schema)

## 6. 共用节点模板

所有工作流使用相同骨架：

```text
Start
→ Code: 输入解析与边界检查
→ IF/ELSE: 检索方式
→ Knowledge Retrieval（必要时）
→ Variable Aggregator: 合并上下文
→ IF/ELSE: 任务/输出类型
→ LLM: Structured Output
→ Tool: validate_candidate_output
→ IF/ELSE: 有效 / 格式修复一次 / 失败
→ Output
```

Dify LLM 节点支持配置结构化输出；Iteration 可对数组运行子流程并支持并行；Template 用于确定性格式化，而不是把无须推理的拼接交给模型。[Dify 工作流节点示例](https://docs.dify.ai/en/guides/application-orchestrate/creating-an-application)

### 6.1 不使用 Agent 节点

首期不使用 Agent 自主选择工具。合规任务更看重稳定、可测试和可追溯，节点和工具调用应明确编排。以后如果增加法规研究辅助，也应与正式评估工作流隔离。

### 6.2 输出校验工具

`validate_candidate_output` 是唯一允许的“校验类工具”，权限仅限：

- 验证本次输出 Schema；
- 验证事实、问题、规则、场景和来源编码；
- 验证引用属于本次输入 manifest；
- 检查 confirmed、approved、certified 等越权输出；
- 返回 `valid/errors`。

它不能新建事实、修改评估、关闭任务、批准文档或写入正式表单。

## 7. 六个首期工作流

### 7.1 `enterprise_profile_interview`

用途：从自由文本或种子材料提取候选事实，或者生成最少必要的下一批问题。

Dify 介入条件：上传材料、长文本答案、事实冲突或固定问题树无法解决的缺口。普通选择题直接映射事实时不调用。

输出：`fact_question`。

控制指标：

- 一轮最多 8 题、blocking 最多 3 题；
- AI 事实全部为 candidate；
- 已 confirmed 的事实不重复询问；
- 外资身份不得自动生成跨境事实。

### 7.2 `small_processor_qualification`

用途：解释后端资格规则，或为 `UNKNOWN` 规则提出补充问题。

Dify 不负责资格结论。标准规则消息足够时，不调用 Dify。

输出：`fact_question` 或 `assessment`。

### 7.3 `scenario_triage`

用途：比较法规要求、企业事实、现行文本与拟开展场景，给出场景分流草稿。

输出：

- 事实不足：`fact_question`；
- 事实足够：`assessment`。

分流只能从五个代码中选择，且仍需主平台规则和人工确认。

### 7.4 `privacy_notice_generate_review`

用途：审查现有声明，或生成新的结构化草稿。

两个任务分支：

- `review_document` → assessment；
- `draft_document` → document。

AI 输出始终是草稿。未解决占位符、事实冲突或无依据条款会阻止进入批准状态。文档版本和发布流程完全在主平台。

### 7.5 `pipia_assessment`

用途：对已由规则引擎触发的 P01—P05 生成工作底稿分析。

AI 不决定是否触发 PIPIA，不修改官方五类情形和三个固定维度，不生成签字结果。

输出：`fact_question` 或 `assessment`。

### 7.6 `audit_self_check`

用途：辅助分析 A01—A24 的事实、证据、缺口和整改。

采用 4 批、每批最多 6 项的 Iteration；并行度先设为 2。每批独立检索和结构化输出，最后由确定性 Code 节点按 A01—A24 顺序合并、去重任务。最终官方表格不由模型自由汇总。

## 8. Prompt 包结构

```text
dify/prompts/
├── 00-common-system.v1.md
├── enterprise-profile-interview.v1.md
├── small-processor-qualification.v1.md
├── scenario-triage.v1.md
├── privacy-notice-generate-review.v1.md
├── pipia-assessment.v1.md
└── audit-self-check.v1.md
```

发布时把 common system 与工作流专属 Prompt 拼接到 LLM System Prompt；业务上下文放在 User Prompt 中。不要把法规全文、事实字典全文和输出 Schema 全部硬编码进 Prompt，应该通过运行输入和 Dify Structured Output 配置提供。

### 8.1 Prompt 版本

Prompt 版本与工作流版本分别管理：

- 文案澄清但输入输出不变：只升级 `prompt_version`；
- 节点或模型策略变化：升级 workflow patch/minor；
- 输入输出 Schema 不兼容：升级 major，并创建新 AI Schema；
- 已完成运行继续绑定原工作流、Prompt、模型和 Schema 版本。

### 8.2 防提示注入

共同 Prompt 已明确：企业文本、自由输入和检索片段都是待分析数据，不能改变系统角色或输出结构。除此之外还必须由 AI Gateway：

- 删除凭证和无关字段；
- 限制文本片段长度和数量；
- 禁止任意 URL 和通用 HTTP 工具；
- 只允许本次 run 的引用 ID；
- 对输出执行越权词义和敏感信息检查。

## 9. 通义千问、Kimi、DeepSeek 路由

### 9.1 逻辑模型配置

业务工作流只引用逻辑 profile：

| Profile | 初始对照顺序 | 用途 |
|---|---|---|
| `cn_json_extraction` | 通义千问 → DeepSeek → Kimi | 事实和问题 JSON |
| `cn_legal_analysis` | DeepSeek → 通义千问 → Kimi | 分流、PIPIA、审计分析 |
| `cn_long_context_review` | Kimi → 通义千问 → DeepSeek | 长隐私声明审查 |
| `cn_document_drafting` | 通义千问 → Kimi → DeepSeek | 声明和制度草稿 |

该顺序是待验证的初始试验配置，不是对模型能力的最终结论。最终使用金标指标决定。

### 9.2 Dify 中的实际切换

Dify LLM 节点在已发布工作流中绑定具体 provider/model。首期不在一个画布中复制三套模型分支，而采用：

1. `workflow_code + version` 指向一个已测试 Dify App；
2. App ID、provider、model 存在环境绑定表，不写进 Git 和 Prompt；
3. 切换模型先克隆或发布新的 Dify App 版本；
4. 用同一金标集运行后再修改 AI Gateway 的部署绑定；
5. 直接模型调用任务可以由 AI Gateway 动态选择 provider，但仍使用相同输出 Schema。

Dify 的模型插件机制支持配置不同模型提供商，模型选择本身不应侵入业务数据模型。[模型提供商插件](https://docs.dify.ai/en/develop-plugin/dev-guides-and-walkthroughs/creating-new-model-provider)、[模型配置规范](https://docs.dify.ai/en/develop-plugin/features-and-specs/plugin-types/model-designing-rules)

## 10. 失败和降级

| 失败 | 处理 |
|---|---|
| Dify 连接失败/超时 | 同绑定重试一次；仍失败转备用部署或人工 |
| 模型限流 | 尊重 Retry-After，异步延迟重试 |
| 知识检索为空 | 不让模型凭记忆补全；返回 missing information 或 needs review |
| JSON 语法错误 | 格式修复一次，不允许补充新事实 |
| Schema 不通过 | `invalid_output`，记录字段错误，转人工或备用模型 |
| 引用不存在 | 拒绝候选发现，不自动移除引用后放行 |
| 部分批次失败 | 审计显示批次失败，不生成完整官方结果 |
| Dify 全部不可用 | 用户仍可完成固定问卷、硬规则、手工表单、文档版本和任务 |

Dify 工作流运行详情能提供运行状态、步骤数、Token 和错误等信息，Gateway 只映射必要信息，不把 Dify 内部日志直接暴露给用户。[运行详情](https://docs.dify.ai/en/api-reference/workflow-runs/get-workflow-run-detail)

## 11. 运行日志与可观测性

`ai_run` 至少记录：

- workflow/prompt/schema/ruleset 版本；
- Dify App 绑定版本；
- provider/model；
- 输入 manifest 和内容哈希；
- Dify workflow run ID；
- 状态、耗时、Token、重试次数；
- 原始输出对象键和校验后的结构化输出；
- Schema、引用和安全校验错误；
- 人工是否接受、修改或拒绝草稿。

平台 SSE 只展示：queued、preparing、retrieving、analyzing、validating、succeeded、failed，不展示模型隐藏推理过程。

## 12. 金标评测与发布门槛

### 12.1 分配建议

首批至少 80 个案例：

| 工作流 | 案例数 |
|---|---:|
| 企业画像 | 15 |
| 资格解释 | 10 |
| 场景分流 | 20 |
| 隐私声明审查/生成 | 15 |
| PIPIA | 10 |
| 审计自查 | 10 |

案例必须包括普通 B2B、外资但无跨境、内资使用境外 SaaS、招聘、员工、营销、监控、人脸、未成年人和敏感信息。

### 12.2 共同指标

- JSON Schema 有效率 ≥ 99%；
- 引用存在率 = 100%；
- 引用实际支持结论率 ≥ 95%；
- 未注册事实/问题编码输出率 = 0；
- AI confirmed 事实、正式批准或整体认证输出率 = 0；
- 外资身份误判跨境率 = 0；
- 错误放行率：金标高风险案例中低于 1%，且不能存在系统性错误；
- 同一输入重复 5 次，分流代码一致率 ≥ 95%；
- 缺失关键事实召回率 ≥ 95%。

每个模型分别记录效果、延迟和成本。模型价格或上下文长度变化不直接触发业务改造，只修改部署绑定和预算策略。

## 13. 部署步骤

1. 部署 Dify 并安装所需模型、Embedding 和 Rerank Provider；
2. 建立只含官方资料的知识库和元数据；
3. 使用 20 个查询测试召回和条款完整性；
4. 在 Dify Studio 按 registry 创建六个 Workflow App；
5. 导入 LLM Structured Output Schema；
6. 配置只读检索和输出校验工具；
7. 发布工作流版本，记录 App ID、provider、model；
8. AI Gateway 写入环境绑定，不把 API Key 和 App ID 暴露前端；
9. 运行 80 个金标案例和负向安全案例；
10. 达到门槛后将 registry 状态从 draft 改为 verified/published。

实际 Dify DSL 不手写进入本版基线。应在目标 Dify 实例安装好 Provider、确定版本和 App ID 后，由 Dify 导出已测试 DSL 再纳入版本管理。`workflow-registry.v1.json` 是平台无关的产品工作流清单，不冒充可直接导入的 Dify DSL。

## 14. 开发验收

- 六个 workflow code 与 OpenAPI、AI Request Schema 完全一致；
- 所有 Prompt 和输出 Schema 路径存在；
- 工作流节点 ID 唯一，边引用有效；
- 首期节点清单中不存在 Human Input、Agent 和正式写工具；
- 企业文档不进入共享 Dify 知识库；
- Dify 输入不含持久 tenant ID；
- 不依赖 Dify 也能完成平台基础合规流程；
- Dify 失败、模型切换和格式错误均有确定降级路径；
- 任何 AI 输出必须先通过 AI Gateway 校验，再以 candidate/draft 进入主平台。
