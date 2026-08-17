import { getMaterialAiConfiguration, getStoredMaterialAiRuntimeConfiguration } from "./db.ts";
import type { MaterialAiConfiguration, MaterialAiProvider, MaterialAiRuntimeConfiguration } from "./types.ts";

type Environment = Record<string, string | undefined>;
type DirectProvider = Exclude<MaterialAiProvider, "auto" | "disabled">;

export const materialAiProviderOptions: Array<{ code: MaterialAiProvider; name: string; description: string }> = [
  { code: "auto", name: "自动选择环境配置", description: "按 DeepSeek、通义千问、Kimi 的顺序使用服务器已经配置的服务。" },
  { code: "deepseek", name: "DeepSeek", description: "使用 DeepSeek 的 OpenAI 兼容接口。" },
  { code: "qwen", name: "通义千问", description: "使用阿里云百炼的 OpenAI 兼容接口。" },
  { code: "kimi", name: "Kimi", description: "使用 Moonshot 的 OpenAI 兼容接口。" },
  { code: "custom", name: "其他兼容服务", description: "接入其他提供 OpenAI 兼容 Chat Completions 接口的服务。" },
  { code: "disabled", name: "不使用 AI", description: "只生成本地基础模板。" }
];

const defaults: Record<DirectProvider, { apiBaseUrl: string; model: string; keyName: string }> = {
  deepseek: { apiBaseUrl: "https://api.deepseek.com", model: "deepseek-v4-flash", keyName: "DEEPSEEK_API_KEY" },
  qwen: { apiBaseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1", model: "qwen-plus", keyName: "DASHSCOPE_API_KEY" },
  kimi: { apiBaseUrl: "https://api.moonshot.cn/v1", model: "kimi-k2.6", keyName: "MOONSHOT_API_KEY" },
  custom: { apiBaseUrl: "", model: "", keyName: "MATERIAL_AI_API_KEY" }
};

const envPrefix = (provider: DirectProvider) => provider === "qwen" ? "QWEN" : provider === "kimi" ? "KIMI" : provider === "custom" ? "MATERIAL_AI" : "DEEPSEEK";

function environmentRuntime(provider: DirectProvider, env: Environment): MaterialAiRuntimeConfiguration | null {
  const base = defaults[provider];
  const apiKey = String(env[base.keyName] || "").trim();
  if (!apiKey) return null;
  const prefix = envPrefix(provider);
  const apiBaseUrl = String(env[`${prefix}_API_BASE_URL`] || base.apiBaseUrl).replace(/\/$/, "");
  const model = String(env[`${prefix}_MODEL`] || base.model).trim();
  if (!apiBaseUrl || !model) return null;
  return { provider, apiBaseUrl, model, apiKey };
}

export function resolveMaterialAiRuntimeConfiguration(env: Environment = process.env): MaterialAiRuntimeConfiguration | null {
  const selected = getMaterialAiConfiguration();
  if (selected.provider === "disabled") return null;
  if (selected.provider === "auto") {
    for (const provider of ["deepseek", "qwen", "kimi"] as DirectProvider[]) {
      const runtime = environmentRuntime(provider, env);
      if (runtime) return runtime;
    }
    return environmentRuntime("custom", env);
  }
  const stored = getStoredMaterialAiRuntimeConfiguration();
  if (stored) return {
    ...stored,
    apiBaseUrl: (stored.apiBaseUrl || defaults[stored.provider].apiBaseUrl).replace(/\/$/, ""),
    model: stored.model || defaults[stored.provider].model
  };
  return environmentRuntime(selected.provider, env);
}

export function getMaterialAiStatus(env: Environment = process.env): MaterialAiConfiguration & {
  configured: boolean;
  activeProvider: string | null;
  activeModel: string | null;
} {
  const selected = getMaterialAiConfiguration();
  const runtime = resolveMaterialAiRuntimeConfiguration(env);
  return { ...selected, configured: Boolean(runtime), activeProvider: runtime?.provider || null, activeModel: runtime?.model || null };
}

export function providerDefaults(provider: MaterialAiProvider): { apiBaseUrl: string; model: string } {
  if (provider === "auto" || provider === "disabled") return { apiBaseUrl: "", model: "" };
  return defaults[provider];
}

export function normalizeMaterialAiBaseUrl(value: string): string {
  const normalized = value.trim().replace(/\/$/, "");
  if (!normalized) return "";
  const url = new URL(normalized);
  const local = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  if (url.protocol !== "https:" && !(local && url.protocol === "http:")) throw new Error("AI接口地址必须使用 HTTPS；本机地址可以使用 HTTP。");
  if (url.username || url.password) throw new Error("AI接口地址中不能包含用户名或密码。");
  return normalized;
}
