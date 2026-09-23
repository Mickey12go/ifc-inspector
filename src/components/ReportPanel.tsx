import { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Crosshair,
  Download,
  Eraser,
  Sparkles,
  AlertOctagon,
  AlertTriangle,
  Info,
  CheckCircle2,
} from "lucide-react";
import type { QaReport, RuleResult, Severity } from "../lib/ifc/types";
import { exportReportCsv, exportReportJson } from "../lib/export";

const SEVERITY_ICON: Record<Severity, typeof AlertOctagon> = {
  error: AlertOctagon,
  warning: AlertTriangle,
  info: Info,
};

const SEVERITY_TEXT: Record<Severity, string> = {
  error: "text-danger",
  warning: "text-warning",
  info: "text-accent",
};

export type IssueSelection = { key: string; guids: string[] } | null;

function statusDot(rule: RuleResult): string {
  if (rule.affectedCount === 0) return "bg-success";
  if (rule.severity === "error") return "bg-danger";
  if (rule.severity === "warning") return "bg-warning";
  return "bg-accent";
}

function RuleGroup({
  rule,
  selected,
  onSelect,
}: {
  rule: RuleResult;
  selected: IssueSelection;
  onSelect: (key: string, guids: string[]) => void;
}) {
  const [open, setOpen] = useState(rule.affectedCount > 0);
  const Icon = SEVERITY_ICON[rule.severity];
  return (
    <div className="rounded-lg border border-border bg-surface2">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left">
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${statusDot(rule)}`} />
        <Icon className={`h-4 w-4 shrink-0 ${rule.affectedCount > 0 ? SEVERITY_TEXT[rule.severity] : "text-success"}`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="truncate text-sm font-medium">{rule.name}</span>
            <span className="shrink-0 text-xs text-muted">
              {rule.affectedCount === 0 ? "通过" : `${rule.affectedCount} 个问题`}
            </span>
          </div>
        </div>
        {open ? <ChevronDown className="h-4 w-4 shrink-0 text-muted" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted" />}
      </button>
      {open && rule.issues.length > 0 && (
        <ul className="space-y-1 border-t border-border px-2 py-2">
          {rule.issues.map((issue, i) => {
            const key = `${rule.id}:${i}`;
            const isSelected = selected?.key === key;
            const clickable = issue.guids.length > 0;
            return (
              <li key={key}>
                <button
                  disabled={!clickable}
                  onClick={() => onSelect(key, issue.guids)}
                  title={clickable ? (isSelected ? "再次点击取消高亮" : "在 3D 视图中定位") : "无关联构件"}
                  className={`flex w-full items-start gap-2 rounded border px-2 py-1.5 text-left text-xs transition-colors ${
                    isSelected
                      ? "border-accent bg-accent/15"
                      : clickable
                        ? "border-transparent hover:border-border hover:bg-surface"
                        : "border-transparent opacity-70"
                  }`}
                >
                  {clickable && (
                    <Crosshair className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${isSelected ? "text-accent" : "text-muted"}`} />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block break-words">{issue.message}</span>
                    {issue.detail && <span className="mt-0.5 block break-words text-muted">{issue.detail}</span>}
                    {issue.guids.length > 0 && (
                      <span className="mt-0.5 block font-mono text-[10px] text-muted">
                        {issue.guids.slice(0, 3).join(", ")}
                        {issue.guids.length > 3 ? ` +${issue.guids.length - 3}` : ""}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function AdviseSection({ report }: { report: QaReport }) {
  const [state, setState] = useState<
    { status: "idle" } | { status: "loading" } | { status: "done"; text: string } | { status: "error"; text: string }
  >({ status: "idle" });

  const ask = async () => {
    setState({ status: "loading" });
    try {
      const res = await fetch("/api/advise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(report),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.configured === false) {
        setState({ status: "error", text: "未配置 API Key：请在部署平台设置 OPENAI_API_KEY 环境变量后重试。" });
      } else {
        setState({ status: "done", text: String(data.advice ?? "") });
      }
    } catch {
      setState({
        status: "error",
        text: "AI 服务不可用（本地开发环境无 /api 接口，请部署到 Vercel 后使用）。",
      });
    }
  };

  return (
    <div className="rounded-lg border border-border bg-surface2 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium">AI Suggestions（AI 生成改进建议）</p>
          <p className="mt-0.5 text-xs text-muted">面向非技术用户的 3 条中文建议</p>
        </div>
        <button
          onClick={() => void ask()}
          disabled={state.status === "loading"}
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-black hover:opacity-90 disabled:opacity-50"
        >
          <Sparkles className="h-3.5 w-3.5" />
          {state.status === "loading" ? "生成中…" : "生成建议"}
        </button>
      </div>
      {state.status === "done" && (
        <p className="mt-3 whitespace-pre-wrap rounded bg-surface p-3 text-sm leading-relaxed">{state.text}</p>
      )}
      {state.status === "error" && <p className="mt-3 text-xs text-warning">{state.text}</p>}
    </div>
  );
}

interface ToolbarProps {
  report: QaReport;
  modelName: string;
  hasSelection: boolean;
  onClear: () => void;
}

export function WorkbenchToolbar({ report, modelName, hasSelection, onClear }: ToolbarProps) {
  const counts = useMemo(() => {
    const all = [...report.rules, ...report.privacy];
    return {
      errors: all.filter((r) => r.severity === "error" && r.affectedCount > 0).length,
      warnings: all.filter((r) => r.severity === "warning" && r.affectedCount > 0).length,
      infos: all.filter((r) => r.severity === "info" && r.affectedCount > 0).length,
    };
  }, [report]);

  const scoreColor =
    report.healthScore >= 80 ? "text-success border-success" : report.healthScore >= 50 ? "text-warning border-warning" : "text-danger border-danger";

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border bg-surface px-4 py-2">
      <div className={`flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-bold ${scoreColor}`}>
        {report.healthScore}
      </div>
      <div className="flex items-center gap-3 text-xs">
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-danger" />{counts.errors} 错误</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-warning" />{counts.warnings} 警告</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-accent" />{counts.infos} 提示</span>
      </div>
      <span className="hidden truncate text-xs text-muted lg:inline">
        {report.schema} · {report.elementCount.toLocaleString()} 个构件
      </span>
      <div className="ml-auto flex items-center gap-2">
        {hasSelection && (
          <button
            onClick={onClear}
            className="flex items-center gap-1.5 rounded-lg border border-accent/50 px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/10"
          >
            <Eraser className="h-3.5 w-3.5" /> 清除高亮
          </button>
        )}
        <button
          onClick={() => exportReportJson(report, modelName)}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-surface2"
        >
          <Download className="h-3.5 w-3.5" /> JSON
        </button>
        <button
          onClick={() => exportReportCsv(report, modelName)}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-surface2"
        >
          <Download className="h-3.5 w-3.5" /> CSV
        </button>
      </div>
    </div>
  );
}

interface PanelProps {
  report: QaReport;
  selected: IssueSelection;
  onSelect: (key: string, guids: string[]) => void;
}

export function ReportPanel({ report, selected, onSelect }: PanelProps) {
  return (
    <div className="flex-1 space-y-4 overflow-y-auto p-4">
      <div className="flex items-center gap-2 text-xs text-muted">
        <CheckCircle2 className="h-3.5 w-3.5" />
        点击任意问题可在右侧 3D 视图中定位构件；再次点击取消高亮。
      </div>
      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">质检规则</h3>
        {report.rules.map((rule) => (
          <RuleGroup key={rule.id} rule={rule} selected={selected} onSelect={onSelect} />
        ))}
      </section>
      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">信息泄露审计</h3>
        {report.privacy.map((rule) => (
          <RuleGroup key={rule.id} rule={rule} selected={selected} onSelect={onSelect} />
        ))}
      </section>
      <AdviseSection report={report} />
    </div>
  );
}
