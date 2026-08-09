# API 契约说明

- `openapi.v1.yaml`：OpenAPI 3.1 首期契约，包含 38 条资源和动作路径；
- 业务接口：`/api/v1`；
- 公共隐私声明和权利请求：`/public/v1`；
- 主平台调用 AI Gateway：`/internal/v1`。

## 使用约束

1. 登录用户的租户由认证上下文确定，外部业务请求体不得传入 `tenant_id`；
2. POST 写操作按契约要求使用 `Idempotency-Key`；
3. 状态动作和并发更新使用 `If-Match`；
4. AI、导出和文档解析使用异步 Job；
5. 自动生成服务端接口或前端客户端后，仍需实现领域状态机、租户隔离和权限校验；
6. AI Schema 位于 `../schemas/ai`，不得用通用 `object` 绕过其校验。

## 校验

开发环境安装 `../tools/contract-validation/requirements.txt` 后执行：

```powershell
python .\tools\contract-validation\validate_contracts.py
```

测试同时覆盖 OpenAPI、AI Schema、示例和关键负向用例。
