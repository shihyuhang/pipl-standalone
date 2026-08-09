# Dify 可导入工作流

## 文件

- `scenario-triage-mvp-v1.yml`：业务场景快速分流 Workflow DSL；
- `scenario-triage-test-inputs.json`：三个发布前测试案例。

## 导入

1. 登录 Dify；
2. 进入“工作室”；
3. 选择“导入 DSL 文件”；
4. 上传 `scenario-triage-mvp-v1.yml`；
5. 打开“场景分流分析”节点，确认模型为可用的通义模型；
6. 依次使用测试文件中的三个案例运行；
7. 发布 Workflow；
8. 在“访问 API”中创建专用 API Key。

本 DSL 按当前已有 Dify 导出文件的 `version: 0.6.0`、`langgenius/tongyi:0.2.0` 和 `qwen3.6-plus` 配置生成。如果导入后模型显示不可用，只需在 LLM 节点重新选择当前已配置的通义、DeepSeek 或 Kimi 模型，输入输出结构不需要修改。

平台 `.env.local`：

```env
DIFY_API_BASE_URL=https://dify.legalkit.xyz/v1
DIFY_ENABLE=true
DIFY_API_KEY_SCENARIO_TRIAGE=app-请在本地填写
```

API Key 不得写入 DSL 或提交到代码仓库。
