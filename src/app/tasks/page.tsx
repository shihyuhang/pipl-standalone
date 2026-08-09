"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Check, CheckCircle2, Circle, Clock3, RefreshCw } from "lucide-react";
import type { DashboardData, TaskItem } from "@/lib/types";

export default function TasksPage() {
  const [tasks, setTasks] = useState<TaskItem[]>([]); const [filter, setFilter] = useState<"open" | "completed">("open"); const [busy, setBusy] = useState("");
  const load = () => fetch("/api/dashboard", { cache: "no-store" }).then(r => r.json()).then((data: DashboardData) => setTasks(data.tasks));
  useEffect(() => { void load(); }, []);
  const update = async (id: string, status: TaskItem["status"]) => { setBusy(id); await fetch(`/api/tasks/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) }); await load(); setBusy(""); };
  const visible = tasks.filter(t => filter === "completed" ? t.status === "completed" : t.status !== "completed");
  return <><section className="page-heading"><div><p className="eyebrow">办理事项</p><h1>把要求变成可以完成的任务</h1><p>每项任务都说明为什么做，以及做到什么程度才算完成。</p></div></section><div className="tab-bar"><button className={filter === "open" ? "active" : ""} onClick={() => setFilter("open")}>需要办理 <span>{tasks.filter(t => t.status !== "completed").length}</span></button><button className={filter === "completed" ? "active" : ""} onClick={() => setFilter("completed")}>已经完成 <span>{tasks.filter(t => t.status === "completed").length}</span></button></div><section className="card task-board">{visible.length ? visible.map(task => <article className="task-item" key={task.id}><button className={`task-check ${task.status === "completed" ? "done" : ""}`} disabled={busy === task.id} onClick={() => update(task.id, task.status === "completed" ? "open" : "completed")}>{busy === task.id ? <RefreshCw className="spin" size={17} /> : task.status === "completed" ? <Check size={17} /> : <Circle size={17} />}</button><div className="task-body"><div><span className="task-category">{task.category}</span>{task.priority === "high" && <span className="priority"><AlertTriangle size={13} /> 优先确认</span>}</div><h3>{task.title}</h3><p>{task.description}</p><div className="acceptance"><CheckCircle2 size={15} /> 完成后将记录负责人和完成时间，作为合规档案的一部分。</div></div>{task.status !== "completed" && <button className="button small secondary" onClick={() => update(task.id, task.status === "open" ? "in_progress" : "open")}><Clock3 size={14} /> {task.status === "open" ? "开始办理" : "办理中"}</button>}</article>) : <div className="all-clear centered"><CheckCircle2 /><div><strong>{filter === "completed" ? "还没有已完成记录" : "当前事项都已处理"}</strong><p>{filter === "completed" ? "完成任务后会自动出现在这里。" : "有业务变化时，系统会生成新的待办。"}</p></div></div>}</section></>;
}
