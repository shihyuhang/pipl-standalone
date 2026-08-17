"use client";

import { useEffect, useState } from "react";
import { Bot, Check, KeyRound, RefreshCw, Save, ShieldCheck, Sparkles, Wifi } from "lucide-react";
import type { MaterialAiProvider } from "@/lib/types";

type ProviderOption = { code: MaterialAiProvider; name: string; description: string };
type AiSettingsPayload = {
  provider: MaterialAiProvider;
  apiBaseUrl: string;
  model: string;
  hasApiKey: boolean;
  configured: boolean;
  activeProvider: string | null;
  activeModel: string | null;
  updatedAt: string | null;
  options: ProviderOption[];
  defaults: Record<MaterialAiProvider, { apiBaseUrl: string; model: string }>;
};

export default function AiSettingsPage() {
  const [settings, setSettings] = useState<AiSettingsPayload | null>(null);
  const [provider, setProvider] = useState<MaterialAiProvider>("auto");
  const [apiBaseUrl, setApiBaseUrl] = useState("");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [clearApiKey, setClearApiKey] = useState(false);
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);

  const applyPayload = (payload: AiSettingsPayload) => {
    setSettings(payload); setProvider(payload.provider); setApiBaseUrl(payload.apiBaseUrl); setModel(payload.model);
    setApiKey(""); setClearApiKey(false);
  };

  useEffect(() => {
    void fetch("/api/settings/ai", { cache: "no-store" }).then(response => response.json()).then(applyPayload)
      .catch(() => setMessage({ tone: "danger", text: "暂时无法读取AI配置。" }));
  }, []);

  const selectProvider = (next: MaterialAiProvider) => {
    setProvider(next); setMessage(null); setClearApiKey(false); setApiKey("");
    const defaults = settings?.defaults[next];
    setApiBaseUrl(defaults?.apiBaseUrl || ""); setModel(defaults?.model || "");
  };

  const save = async () => {
    setBusy(true); setMessage(null);
    const response = await fetch("/api/settings/ai", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, apiBaseUrl, model, apiKey: apiKey || undefined, clearApiKey })
    });
    const payload = await response.json();
    if (response.ok) {
      const refreshed = await fetch("/api/settings/ai", { cache: "no-store" }).then(item => item.json());
      applyPayload(refreshed); setMessage({ tone: "success", text: payload.configured ? "AI配置已保存并可用于生成材料。" : "配置已保存；当前尚未检测到可用密钥。" });
    } else setMessage({ tone: "danger", text: payload.message || "无法保存AI配置。" });
    setBusy(false);
  };

  const testConnection = async () => {
    setTesting(true); setMessage(null);
    const response = await fetch("/api/settings/ai/connection-test", { method: "POST" });
    const payload = await response.json();
    setMessage({ tone: response.ok ? "success" : "danger", text: payload.message || (response.ok ? "连接成功。" : "连接失败。") });
    setTesting(false);
  };

  if (!settings) return <div className="loading"><RefreshCw className="spin" /> 正在读取AI配置…</div>;
  const direct = !["auto", "disabled"].includes(provider);
  const providerChanged = provider !== settings.provider;

  return <>
    <section className="page-heading"><div><p className="eyebrow">系统设置</p><h1>AI 服务</h1><p>选择材料草稿使用的AI服务。密钥只在本机服务端保存，不会返回页面或写入材料。</p></div></section>
    <section className="ai-status-card"><div className={settings.configured ? "ai-status-icon ready" : "ai-status-icon"}>{settings.configured ? <Sparkles /> : <Bot />}</div><div><span>材料草稿AI</span><strong>{settings.configured ? `${settings.activeProvider} · ${settings.activeModel}` : provider === "disabled" ? "已关闭" : "尚未配置完成"}</strong><p>{settings.configured ? "生成材料时可以选择“AI生成完整草稿”，失败时自动退回基础模板。" : "完成服务选择和密钥配置后，材料向导会开放AI完整草稿。"}</p></div><div className={`config-state ${settings.configured ? "ready" : ""}`}>{settings.configured ? <><Check size={13} /> 可用</> : "未连接"}</div></section>

    <section className="card ai-settings-card"><div className="card-header"><div><p className="eyebrow">第一步</p><h2>选择接入方式</h2></div><Bot /></div><div className="ai-provider-grid">{settings.options.map(item => <button key={item.code} className={provider === item.code ? "ai-provider selected" : "ai-provider"} onClick={() => selectProvider(item.code)}><div><strong>{item.name}</strong><p>{item.description}</p></div>{provider === item.code && <Check />}</button>)}</div></section>

    {direct && <section className="card ai-settings-card"><div className="card-header"><div><p className="eyebrow">第二步</p><h2>填写服务信息</h2></div><KeyRound /></div><div className="ai-settings-fields"><label className="field"><span>接口地址</span><input value={apiBaseUrl} onChange={event => setApiBaseUrl(event.target.value)} placeholder="https://…/v1" /><small className="field-help">填写服务的 OpenAI 兼容接口根地址，系统会调用 /chat/completions。</small></label><label className="field"><span>模型名称</span><input value={model} onChange={event => setModel(event.target.value)} placeholder="模型标识" /></label><label className="field"><span>API 密钥</span><input type="password" autoComplete="new-password" value={apiKey} onChange={event => { setApiKey(event.target.value); setClearApiKey(false); }} placeholder={settings.hasApiKey && !providerChanged ? "密钥已安全保存；不填写则保持不变" : "请输入该服务的API密钥"} /><small className="field-help">页面不会读取或显示已经保存的密钥。更换服务时需要重新填写，或者在服务器环境变量中配置。</small></label>{settings.hasApiKey && !providerChanged && <label className="check-line compact"><input type="checkbox" checked={clearApiKey} onChange={event => { setClearApiKey(event.target.checked); if (event.target.checked) setApiKey(""); }} /><span><strong>清除已经保存的密钥</strong><small>保存后该密钥将无法恢复。</small></span></label>}</div></section>}

    <div className="ai-privacy-note"><ShieldCheck /><div><strong>最少必要传输</strong><p>生成完整草稿时，仅发送所选材料需要的企业档案、已确认业务事实和基础模板。API密钥不会发送给除所选AI服务之外的任何服务，也不会进入版本正文。</p></div></div>
    {message && <div className={`alert ${message.tone}`}>{message.text}</div>}
    <div className="settings-actions"><button className="button secondary" disabled={testing || !settings.configured} onClick={testConnection}>{testing ? <RefreshCw className="spin" size={16} /> : <Wifi size={16} />} 测试当前连接</button><button className="button primary" disabled={busy || (direct && (!apiBaseUrl || !model))} onClick={save}>{busy ? <RefreshCw className="spin" size={16} /> : <Save size={16} />} 保存配置</button></div>
  </>;
}
