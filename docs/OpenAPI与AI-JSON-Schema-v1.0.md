# OpenAPI 与 AI JSON Schema V1.0

> 状态：开发基线草案  
> 范围：面向小型个人信息处理者的首期平台  
> 配套文件：`api/openapi.v1.yaml`、`schemas/ai/*.schema.json`  
> 核心约束：主平台掌握正式事实、状态、规则、审批和证据；AI 仅产生候选内容和草稿

## 1. 目标

本设计把下列三条边界固定为可测试的机器契约：

1. 浏览器或移动端与主平台 REST API；
2. 主平台与内部 AI Gateway；
3. AI Gateway 与 Dify、通义千问、Kimi、DeepSeek 等可替换模型。

首期不追求覆盖全部后台管理接口。重点保证这条业务主链可以独立开发和验收：

> 企业建档 → 场景访谈 → 事实确认 → 规则判断 → AI 辅助分析 → 用户/专业人员确认 → 整改 → 文档版本发布 → 留证

## 2. 契约分层

### 2.1 外部业务 API

统一前缀 `/api/v1`，服务平台登录用户。认证上下文确定 `tenant_id` 和 `user_id`，请求体不得自行指定租户。

### 2.2 公共 API

统一前缀 `/public/v1`，仅提供已发布隐私声明、最小化的权利请求提交和申请状态查询。公共接口不得暴露企业内部事实、评估、任务或文档草稿。

### 2.3 内部 AI Gateway API

统一前缀 `/internal/v1`，只允许服务身份调用。业务模块不得直接调用 Dify App API 或模型供应商 API。

主平台可以把 `tenant_id` 交给 AI Gateway 用于鉴权、配额和审计，但 Gateway 在组装 Dify/模型输入时必须删除持久租户标识，改用一次性 `run_id` 和不可反查的 `workspace_token`。

## 3. 通用协议

### 3.1 认证

- `/api/v1`：OIDC/OAuth2 Bearer Token；
- `/public/v1`：公开读取或一次性请求令牌，配合限流和验证码策略；
- `/internal/v1`：服务身份、短期 Token 或双向 TLS；
- Dify 和模型 API Key 仅保存在 AI Gateway 的密钥管理中。

### 3.2 请求头

| 请求头 | 适用范围 | 说明 |
|---|---|---|
| `Authorization` | 登录和内部接口 | Bearer Token |
| `X-Request-Id` | 全部 | 调用方请求 ID；缺失时服务端生成 |
| `traceparent` | 全部 | OpenTelemetry 链路上下文 |
| `Idempotency-Key` | POST 写操作 | 同一主体、接口和请求体在 24 小时内返回同一结果 |
| `If-Match` | 更新和状态动作 | 使用资源 ETag 防止覆盖并发修改 |
| `Accept-Language` | 用户接口 | 首期支持 `zh-CN`，外资企业可预留 `en` |

### 3.3 统一成功响应

普通资源直接返回资源对象，HTTP 状态表达结果；异步启动返回 `202 Accepted`：

```json
{
  "job_id": "4b786688-c91d-4d57-90a8-67088c81986c",
  "status": "queued",
  "status_url": "/api/v1/jobs/4b786688-c91d-4d57-90a8-67088c81986c"
}
```

列表统一返回：

```json
{
  "items": [],
  "next_cursor": null,
  "has_more": false
}
```

### 3.4 统一错误响应

采用 `application/problem+json`：

```json
{
  "type": "https://pipl.local/problems/validation-error",
  "title": "请求内容不完整",
  "status": 422,
  "code": "VALIDATION_ERROR",
  "detail": "需要补充当前处理人数的统计口径",
  "request_id": "req_01",
  "errors": [
    {
      "pointer": "/answers/0/value",
      "code": "REQUIRED",
      "message": "该问题是当前路径的必答项"
    }
  ]
}
```

首期错误码至少包括：

- `AUTHENTICATION_REQUIRED`、`FORBIDDEN`、`TENANT_SCOPE_VIOLATION`；
- `RESOURCE_NOT_FOUND`、`VERSION_CONFLICT`、`INVALID_STATE_TRANSITION`；
- `VALIDATION_ERROR`、`UNKNOWN_QUESTION_CODE`、`UNKNOWN_FACT_CODE`；
- `FACT_CONFIRMATION_REQUIRED`、`RULE_BLOCKED`、`HUMAN_REVIEW_REQUIRED`；
- `AI_PROVIDER_UNAVAILABLE`、`AI_OUTPUT_INVALID`、`AI_CONTEXT_REJECTED`；
- `IDEMPOTENCY_CONFLICT`、`RATE_LIMITED`。

错误详情不得回显模型密钥、内部 Prompt、原始敏感附件、数据库信息或其他租户标识。

## 4. 核心资源和端点

### 4.1 企业画像与事实

| 方法 | 路径 | 用途 |
|---|---|---|
| `POST` | `/api/v1/profile-sessions` | 创建企业画像访谈 |
| `GET` | `/api/v1/enterprise-profile` | 获取当前企业画像摘要 |
| `GET` | `/api/v1/facts` | 按事实编码、主体和状态查询事实 |
| `POST` | `/api/v1/facts:confirm` | 批量确认候选事实并创建新版本 |
| `POST` | `/api/v1/fact-snapshots` | 冻结本次评估使用的 confirmed 事实 |

AI 提取只能生成 `candidate` 事实。`facts:confirm` 必须由有权用户发起；已有 confirmed 事实不原地覆盖，而是产生新版本并记录替代关系。

### 4.2 处理活动与场景

| 方法 | 路径 | 用途 |
|---|---|---|
| `GET` | `/api/v1/scenario-catalog` | 获取当前 8 个场景和适用提示 |
| `POST` | `/api/v1/processing-activities` | 建立业务处理活动 |
| `GET` | `/api/v1/processing-activities/{activityId}` | 查看活动及事实完整度 |
| `PATCH` | `/api/v1/processing-activities/{activityId}` | 修改名称、负责人或状态 |
| `POST` | `/api/v1/processing-activities/{activityId}/triage-sessions` | 创建场景分流访谈 |

外资企业身份和 B2B 业务模式只是选题上下文，不能由 API 或 AI 自动写入 `XFER.EXISTS=yes`。跨境必须来自存储、传输、远程访问、集团共享或境外运维等得到确认的事实。

### 4.3 访谈会话

| 方法 | 路径 | 用途 |
|---|---|---|
| `GET` | `/api/v1/assessment-sessions/{sessionId}` | 获取会话状态、进度和当前问题 |
| `POST` | `/api/v1/assessment-sessions/{sessionId}/answers` | 批量提交本轮答案 |
| `POST` | `/api/v1/assessment-sessions/{sessionId}:analyze` | 在最低事实完整度满足后启动规则和 AI 分析 |
| `POST` | `/api/v1/assessment-sessions/{sessionId}:confirm-facts` | 确认事实摘要并冻结快照 |
| `POST` | `/api/v1/assessment-sessions/{sessionId}:cancel` | 取消未完成会话 |

会话状态使用：

`draft / in_progress / needs_input / fact_confirmation / analyzing / needs_review / completed / cancelled`

`answers` 接口收到答案后必须由服务端重新执行问题可见性、必答、枚举和阻断检查。前端不能通过提交隐藏问题或任意事实编码绕过问题树。

### 4.4 规则评估与 AI 运行

| 方法 | 路径 | 用途 |
|---|---|---|
| `POST` | `/api/v1/qualifications:assess` | 运行小型处理者资格硬规则 |
| `GET` | `/api/v1/assessments/{assessmentId}` | 查看结构化评估、发现和引用 |
| `POST` | `/api/v1/assessments/{assessmentId}:submit-review` | 提交人工复核结论 |
| `GET` | `/api/v1/ai-runs/{runId}` | 查询 AI 运行状态和已校验草稿 |
| `GET` | `/api/v1/ai-runs/{runId}/events` | 通过 SSE 获取运行进度，不传输模型思维链 |
| `POST` | `/api/v1/ai-runs/{runId}:retry` | 对可重试失败创建新一次运行 |

AI 长任务异步执行。业务侧只保存经 Schema 校验后的输出和必要原始输出对象引用，不把模型过程文本当作正式结论。

### 4.5 隐私声明及其他文档版本

| 方法 | 路径 | 用途 |
|---|---|---|
| `POST` | `/api/v1/documents` | 创建文档容器 |
| `GET` | `/api/v1/documents/{documentId}` | 查看文档及版本列表 |
| `POST` | `/api/v1/documents/{documentId}/versions` | 上传或创建草稿版本 |
| `POST` | `/api/v1/document-versions/{versionId}:request-ai-review` | 启动一致性/完整性审查 |
| `POST` | `/api/v1/document-versions/{versionId}:submit-review` | 提交人工审查意见 |
| `POST` | `/api/v1/document-versions/{versionId}:approve` | 批准版本 |
| `POST` | `/api/v1/document-versions/{versionId}:publish` | 发布并记录渠道、时间和证据 |
| `POST` | `/api/v1/document-versions/{versionId}:supersede` | 用新版本替代当前版本 |

文档状态使用：

`draft / pending_confirmation / under_review / approved / scheduled / effective / superseded / archived`

AI 只能生成 `draft` 内容或 `review_suggestion`，任何 AI 输出都不能直接调用批准或发布动作。所谓恢复旧版本必须创建新版本，不能把历史版本重新改成当前版本。

### 4.6 官方表和整改

| 方法 | 路径 | 用途 |
|---|---|---|
| `POST` | `/api/v1/form-instances` | 创建审计自查或影响评估实例 |
| `GET` | `/api/v1/form-instances/{formInstanceId}` | 查看工作底稿与官方结果 |
| `PUT` | `/api/v1/form-instances/{formInstanceId}/responses/{itemCode}` | 保存单项工作底稿和官方结论 |
| `POST` | `/api/v1/form-instances/{formInstanceId}:ready-to-sign` | 执行完整性检查 |
| `POST` | `/api/v1/form-instances/{formInstanceId}:sign` | 冻结内容、快照、证据和签名 |
| `GET` | `/api/v1/remediation-tasks` | 查询整改任务 |
| `POST` | `/api/v1/remediation-tasks/{taskId}/evidence` | 关联证据 |
| `POST` | `/api/v1/remediation-tasks/{taskId}:submit` | 提交验收 |
| `POST` | `/api/v1/remediation-tasks/{taskId}:accept` | 验收或退回 |

官方结论、签名和整改完成状态全部由主平台控制。AI 可以建议官方结论，但不得写入已签署实例。

### 4.7 公共入口

| 方法 | 路径 | 用途 |
|---|---|---|
| `GET` | `/public/v1/{publicCode}/privacy-notice` | 获取当前公开版本 |
| `POST` | `/public/v1/{publicCode}/rights-requests` | 提交查询、更正、删除等申请 |
| `GET` | `/public/v1/rights-requests/{requestCode}` | 使用一次性令牌查询状态 |

公共错误不得用于枚举企业内部对象或确认某手机号、邮箱是否存在。

## 5. 幂等、并发和状态转换

### 5.1 幂等

以下操作必须要求 `Idempotency-Key`：创建会话、提交答案、确认事实、启动 AI、创建文档版本、批准/发布、签字、提交权利请求。

同一个键和相同请求体返回原结果；同一个键但请求体哈希不同返回 `409 IDEMPOTENCY_CONFLICT`。

### 5.2 ETag

资源读取返回 `ETag: "v{rowVersion}"`。更新、批准、发布、签字和任务验收必须带 `If-Match`。版本不一致返回 `412 VERSION_CONFLICT`。

### 5.3 状态动作

状态不能通过普通 `PATCH` 任意修改。批准、发布、签字、确认、取消等动作使用显式 action endpoint，由领域服务校验合法状态转换、权限和前置条件。

## 6. AI Gateway 调用契约

### 6.1 什么时候调用 Dify/模型

| 任务 | 是否调用 | 理由 |
|---|---|---|
| 人数阈值、状态和官方枚举校验 | 否 | 后端规则确定即可 |
| 从上传政策中提取候选事实 | 是 | 需要语义理解 |
| 判断下一批需要补充的业务问题 | 有条件 | 固定问题树不足或答案有歧义时 |
| 匹配法规条款和企业文本段落 | 是 | 需要检索和语义比对 |
| 生成评估分析、风险说明、整改建议 | 是 | 仅作为结构化草稿 |
| 起草或修改隐私声明 | 是 | 必须绑定事实快照和依据 |
| 资格最终结论、签字、审批、发布 | 否 | 主平台和人工负责 |

Dify 适合编排“检索 → 模型 → Schema 输出 → 必要的工具调用”。若任务只有一次结构化提取、无需知识检索或多步分支，AI Gateway 可以直接调用模型，避免为使用 Dify 而增加链路。

### 6.2 输入最小化

送给 Dify/模型的 `ai-workflow-request` 只能包含：

- 一次性 `run_id` 和 `workspace_token`；
- 工作流、Prompt、输出 Schema 和规则包版本；
- 本任务需要的 confirmed 事实值或 candidate 事实；
- 与本任务有关的文本片段及片段哈希；
- 已由主平台产生的规则结果；
- 当前用户需求和允许生成的输出类型；
- 受控法规条款片段、来源代码和条款号。

不得包含：数据库凭证、模型密钥、完整租户目录、其他场景材料、无关原始附件、用户密码、签名认证材料、其他租户标识。

### 6.3 统一输入 Schema

`ai-workflow-request.v1.schema.json` 规定：

- `workflow`：code/version/prompt_version；
- `task`：type、locale、user_request、allowed_outputs；
- `context`：事实、场景、规则结果、文档片段、法规片段；
- `data_policy`：允许的敏感级别、脱敏动作和禁止输出；
- `output_contract`：输出类型、Schema ID 和版本；
- `model_route`：任务能力、首选/备用供应商和最大预算，由 Gateway 使用，不直接信任前端。

### 6.4 统一输出 Schema

`ai-workflow-response.v1.schema.json` 只接受：

- `needs_input`：候选补充问题；
- `draft_ready`：候选事实、评估发现、整改建议或文本草稿；
- `needs_review`：存在冲突、高风险或引用不足；
- `failed`：可分类失败，不生成业务结论。

每项发现必须关联：

- 支持它的事实引用；
- 支持它的法规条款或企业文本引用；
- `confidence` 和不确定性说明；
- 建议动作；
- 是否必须人工复核。

禁止返回 `compliant=true`、`certified=true`、`approved=true` 等整体认证字段。单项建议可以使用 `suggested_rule_result`，但主平台必须重新运行规则并由人工确认。

## 7. AI 输出子 Schema

### 7.1 候选事实与问题

`ai-fact-question-output.v1.schema.json`：

- 候选事实必须使用事实字典中的 `fact_code`；
- `status` 固定为 `candidate`，不得输出 `confirmed`；
- 必须有来源片段或用户回答引用；
- 候选问题优先引用现有 `question_code`；
- AI 自定义问题必须包含受控 answer type、最多 10 个选项和提出理由；
- AI 不能通过自定义问题写入未注册的事实编码。

### 7.2 评估草稿

`ai-assessment-output.v1.schema.json`：

- 输出摘要、候选发现、引用、建议任务和复核原因；
- 风险只能为 `L0/L1/L2/L3`；
- 发现状态固定为 `draft`；
- 引用必须定位到法规条款、文档片段、事实或规则结果；
- 信息不足必须返回 `missing_information`，不能自行补全事实。

### 7.3 文本草稿

`ai-document-output.v1.schema.json`：

- 文档类型、语言、适用场景和事实快照引用；
- 结构化章节，而不是只返回整段 Markdown；
- 每个章节关联事实、法规来源和变更说明；
- 状态固定为 `draft`；
- 包含占位符时必须列入 `unresolved_placeholders`，未清空不得进入批准状态。

## 8. 模型选择和路由

首期对通义千问、Kimi、DeepSeek 使用统一供应商适配器。工作流定义只声明能力，不把某个模型写死在业务代码中。

| 任务能力 | 优先考虑 | 选择重点 |
|---|---|---|
| 中文法规/制度长文本理解 | Kimi、通义千问 | 长上下文、引用定位、中文稳定性 |
| 结构化事实提取和 JSON 输出 | 通义千问、DeepSeek | Schema 遵循率、字段遗漏率、成本 |
| 复杂差距分析和整改推理 | DeepSeek、通义千问 | 错误放行率、引用支持率、稳定性 |
| 普通文本起草与改写 | 通义千问、Kimi | 风格一致性、可控性、成本 |

这只是首期评测顺序，不作为固定供应商结论。最终路由由金标集结果决定，至少记录：`provider_code`、`model_code`、模型版本、参数、Prompt 版本、Schema 版本、用量和失败原因。

降级顺序：

1. 同供应商重试一次，仅针对超时或限流；
2. 切换备用模型并保留同一输出 Schema；
3. 输出 `needs_review` 或 `failed`；
4. 用户可以继续手工填写、查看文档和处理任务，不能因 AI 不可用锁死业务。

## 9. Dify 介入边界

### 9.1 必须或优先使用 Dify

- 需要法规知识检索并保留召回片段；
- 需要企业文本、事实、场景、规则结果多上下文组装；
- 需要多步骤条件分支或调用主平台只读工具；
- 需要可视化管理 Prompt/工作流版本并记录运行；
- 同一工作流需要在通义千问、Kimi、DeepSeek 之间做模型切换和对照评测。

### 9.2 可以不使用 Dify

- 人数、枚举、状态、期限等确定性规则；
- JSON Schema、权限、租户和幂等校验；
- 简单模板变量替换；
- 已有答案直接映射事实；
- 单次 OCR 后的固定字段提取，若 AI Gateway 直接模型调用更简单；
- 任务、证据、审批、发布和签字。

### 9.3 Dify 工具权限

Dify 只能调用 AI Gateway 暴露的白名单只读工具，例如：

- `get_task_fact_snapshot(run_id)`；
- `get_document_excerpt(run_id, excerpt_id)`；
- `retrieve_regulation_chunks(run_id, query, source_filters)`；
- `validate_candidate_output(run_id, schema_id, payload)`。

不得提供通用数据库查询、对象存储列表、任意 URL 请求、跨租户搜索或正式业务写接口。

## 10. Schema 校验与落库

一次 AI 输出落库前依次执行：

1. JSON 语法解析；
2. `ai-workflow-response` 外层 Schema；
3. 指定子 Schema；
4. 事实、问题、规则、场景和来源编码存在性；
5. 引用范围属于本次输入 manifest；
6. 禁止字段和敏感输出扫描；
7. 整体认证、正式批准等越权语义检查；
8. 保存为 `candidate` 或 `draft`；
9. 由用户、规则引擎或专业人员确认后再进入正式对象。

Schema 不通过时，`ai_run.status=invalid_output`，保存校验错误；可以进行一次“只修复格式、不改变实质内容”的受控重试。仍失败则转人工。

## 11. 日志与隐私

- 业务日志只记录对象 ID、版本、哈希、状态、耗时和错误码；
- 原始 Prompt/输出如需保存，应进入受控对象存储并设置单独权限和留存；
- 禁止在普通应用日志中打印事实全文、权利请求身份材料和未脱敏附件；
- `ai_run.input_manifest` 记录输入对象、版本和哈希，避免无必要复制全文；
- SSE 只发送 `queued/running/retrieving/validating/succeeded/failed` 等阶段，不发送模型隐藏推理过程；
- 所有查看 AI 原始输入输出的操作进入审计日志。

## 12. 契约测试

### 12.1 OpenAPI

- 所有路径、参数和 Schema 引用可解析；
- 所有写操作定义幂等或明确说明不要求；
- 关键状态动作要求 `If-Match`；
- 401/403/404/409/412/422/429/500 错误结构一致；
- 租户 ID 不出现在外部业务请求体；
- 公共接口不返回内部对象 ID 和敏感字段。

### 12.2 AI Schema

- 所有 Schema 通过 Draft 2020-12 校验；
- 示例请求和响应可通过对应 Schema；
- `confirmed` 事实、正式批准、整体认证字段应验证失败；
- 引用不存在于输入 manifest 时应被业务校验拒绝；
- 外资身份单独出现时不得产生确认的跨境事实；
- 模型超时、无引用、非法 JSON、未知编码均有确定失败路径；
- 通义千问、Kimi、DeepSeek 使用同一套输出契约完成金标对照。

## 13. 首期实现顺序

1. 生成 OpenAPI DTO、服务端接口骨架和前端客户端；
2. 实现通用错误、请求 ID、幂等和 ETag；
3. 实现事实、活动、访谈会话和快照接口；
4. 实现规则评估与异步 Job；
5. 实现 AI Gateway 和四个 AI Schema 校验器；
6. 接入一个 Dify 工作流和一个直接模型适配器；
7. 实现隐私声明版本审查、批准和发布；
8. 实现官方表、整改、证据和公共入口；
9. 运行契约测试、权限测试和模型金标测试。

## 14. 验收结论

本设计通过的最低标准是：

- 不使用 Dify 也能完成建档、固定问题、硬规则、文档版本、任务和留证；
- 使用 Dify 后可以稳定返回符合 Schema 的候选问题、评估草稿和文本草稿；
- 更换通义千问、Kimi 或 DeepSeek 不改变业务 API 和正式数据模型；
- AI 无法确认事实、关闭整改、批准文档、签署官方表或发布隐私声明；
- 任一正式结论都能追溯到事实快照、规则包、文本版本、人工确认和证据。
