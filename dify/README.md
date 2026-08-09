# Dify 设计包

本目录不是可直接导入的 Dify DSL，而是创建和验收 Dify 应用的产品级基线：

- `workflow-registry.v1.json`：六个工作流、节点、边、模型 profile、知识和调用策略；
- `prompts/`：共同 System Prompt 与六个工作流 Prompt；
- `knowledge-metadata-schema.v1.json`：共享官方知识片段的元数据约束；
- `deployment-bindings.example.json`：Dify App、provider、model 和密钥引用的环境绑定示例。

实际 DSL 应在目标 Dify 实例安装模型 Provider、配置知识库和工具后，由 Dify 导出，并绑定对应 registry/workflow/prompt/schema 版本。

首期约束：

1. Dify 不保存平台正式事实和长期会话；
2. 不使用 Human Input 和 Agent 节点；
3. 不向 Dify 提供正式业务写接口；
4. 共享知识库只存官方资料；
5. 企业材料由主平台截取、脱敏后按任务传入；
6. 输出必须经过 AI Gateway Schema 和引用校验。

本地校验：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\dify\validate-workflows.ps1
```
