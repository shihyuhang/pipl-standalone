export function StatusBadge({ status }: { status: string }) {
  const labels: Record<string, string> = {
    eligible: "适合小型处理者路径", conditional: "还需补充确认", needs_review: "需要专项复核",
    out_of_scope: "建议转专业服务", not_assessed: "尚未判断", draft: "草稿", active: "已确认",
    effective: "当前发布版本", under_review: "历史待发布", approved: "历史待发布", superseded: "历史版本", open: "待办理",
    current: "内容一致", unpublished: "尚未发布", updating: "草稿待发布", pending_approval: "草稿待发布", overdue: "逾期未处理",
    in_progress: "办理中", completed: "已完成", collecting: "填写中", remediation: "整改中",
    ready_to_sign: "待确认签署", signed: "已确认归档", archived: "已归档"
  };
  return <span className={`status status-${status}`}>{labels[status] || status}</span>;
}
