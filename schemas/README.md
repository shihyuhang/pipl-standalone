# 机器可读配置说明

本目录包含首期事实、动态问题树、场景目录与产品规则配置：

- `fact-schema.v1.json`：事实记录和事实快照的 JSON Schema，同时固定首期允许的事实编码；
- `question-tree.v1.json`：9 个阶段、66 个问题、条件分支、事实映射和 AI Hook；
- `scenario-catalog.v1.json`：首期 8 个基础场景、横切风险分支、场景提问和产物要求；
- `ruleset.v1.json`：52 条版本化产品规则、来源、输入事实、结果和后续动作。

`ai/` 保存模型无关的 AI Gateway 契约：

- `ai-workflow-request.v1.schema.json`：脱敏和最小化后的模型/Dify 输入；
- `ai-workflow-response.v1.schema.json`：统一运行响应；
- `ai-fact-question-output.v1.schema.json`：候选事实和候选问题；
- `ai-assessment-output.v1.schema.json`：评估发现和整改草稿；
- `ai-document-output.v1.schema.json`：隐私声明等文档草稿；
- `ai/examples/`：正向、失败和跨境追问示例。

`ai/` 保存模型无关的 AI Gateway 契约：

- `ai-workflow-request.v1.schema.json`：脱敏和最小化后的模型/Dify 输入；
- `ai-workflow-response.v1.schema.json`：统一运行响应；
- `ai-fact-question-output.v1.schema.json`：候选事实和候选问题；
- `ai-assessment-output.v1.schema.json`：评估发现和整改草稿；
- `ai-document-output.v1.schema.json`：隐私声明等文档草稿；
- `ai/examples/`：正向、失败和跨境追问示例。

## 运行原则

1. 配置发布后不可原地修改；变更必须增加版本并保留旧版本；
2. 评估会话固定绑定创建时的问题树版本；
3. `showWhen`、`requiredWhen` 和 `rules.when` 使用受限的 `PIPL-CEL-1` 表达式，由后端解释器执行，禁止使用 JavaScript `eval`；
4. 表达式只允许读取当前租户会话内的 `fact`、`answer`、`scenario` 和受控 `context`；
5. `transform` 和 `action` 只能调用后端注册表中存在的函数，不得从配置执行任意代码；
6. AI 只能通过 `aiHooks` 生成候选事实、候选问题和草稿，不能确认事实或正式结论；
7. 前端返回答案后，服务端必须重新执行可见性、必填、枚举、类型和阻断规则；
8. 所有事实映射均应验证 `factCode` 存在于 `fact-schema.v1.json`；
9. `x-fact-catalog` 当前列出需要特殊枚举、派生或法律映射的关键事实；未列出的事实仍按 `factCode`、`valueType` 和领域服务校验，不得接收任意编码；
10. 正式评估前必须把 confirmed 事实冻结为 `factSnapshot`。
11. 首期统一使用已批准的规则集，不按法规施行日期切换产品结论；配置只通过版本号发布和追溯；
12. 场景只负责组织提问和产物，规则集负责确定性判断；Dify 或其他模型不得绕过规则集直接改变分流结果。

## `PIPL-CEL-1` 首期能力

允许：

- `==`、`!=`、`in`、`&&`、`||`、`!`；
- 字符串、布尔值、数字、数组字面量；
- `fact('CODE')`、`answer('QUESTION')`；
- 只读字段访问，如 `scenario.type`、`context.hasThirdParty`；
- 白名单函数，如 `containsAny()`、`hasConfirmedOverseasStorageOrAccess()`。

禁止：

- 文件、网络、数据库或系统环境访问；
- 动态类加载、反射和任意函数调用；
- 跨租户对象 ID；
- 在表达式中修改状态。

## CI 校验

每次配置变更至少检查：

- JSON 可以解析；
- 问题编码无重复；
- phase 引用的问题全部存在；
- `factMappings` 中的事实编码全部存在；
- 场景编码和规则编码均无重复；
- 场景引用的问题编码全部存在；
- 规则的 `requiredFacts` 全部存在于事实字典；
- Markdown 规则表中的规则编码与 `ruleset.v1.json` 双向一致；
- Markdown 场景目录中的场景编码与 `scenario-catalog.v1.json` 双向一致；
- action、transform、answerType、规则函数均在后端白名单；
- 关键硬问题未被任何条件错误隐藏；
- 外资身份不会单独将 `XFER.EXISTS` 设为 `yes`；
- ≥10 万人路径必然阻止正式小型处理者结论；
- AI 来源事实必然保持 `candidate` 状态。

本地可执行：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\schemas\validate-config.ps1
```

当前基线应通过：171 个事实编码、66 个问题、9 个阶段、8 个场景、52 条规则。

OpenAPI 与 AI Schema 契约测试见：

```powershell
python .\tools\contract-validation\validate_contracts.py
```

其依赖固定在 `tools/contract-validation/requirements.txt`，当前基线为 38 条 OpenAPI 路径、5 份 AI Schema 和 3 个示例。

OpenAPI 与 AI Schema 契约测试见：

```powershell
python .\tools\contract-validation\validate_contracts.py
```

其依赖固定在 `tools/contract-validation/requirements.txt`，当前基线为 38 条 OpenAPI 路径、5 份 AI Schema 和 3 个示例。
