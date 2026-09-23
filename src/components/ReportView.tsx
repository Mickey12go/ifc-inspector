import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Crosshair, Download, Sparkles } from "lucide-react";
import type { QaReport, RuleResult, Severity } from "../lib/ifc/types";
import { exportReportCsv, exportReportJson } from "../lib/export";

const SEVERITY_COLOR: Record<Severity, string> = {
  error: "bg-danger",
  warning: "bg-warning",
  info: "bg-accent",
};

function statusDot(rule: RuleResult): string {
  if (rule.affectedCount === 0) return "bg-success";
  return SEVERITY_COLOR[rule.severity];
}

function HealthBadge({ score }: { score: number }) {
  const color = score >= 80 ? "text-success border-success" : score >= 50 ? "text-warning border-warning" : "text-danger border-danger";
  return (
    <div className={`flex h-20 w-20 flex-col items-center justify-center rounded-full border-4 ${color}`}>
      <span className="text-2xl font-bold leading-none">{score}</span>
      <span className="text-[10px] uppercase tracking-wide">score</span>
    </div>
  );
}

function RuleCard({
  rule,
  onFocus,
}: {
  rule: RuleResult;
  onFocus: (guids: string[]) => void;
}) {
  const [open, setOpen] = useState(rule.affectedCount > 0 && rule.affectedCount <= 30);
  return (
    <div className="rounded-lg border border-border bg-surface2">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <span className={`h-3 w-3 shrink-0 rounded-full ${statusDot(rule)}`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-medium">{rule.name}</span>
            <span className="text-xs text-muted">
              {rule.affectedCount === 0 ? "通过" : `${rule.affectedCount} 个问题`}
            </span>
          </div>
          <p className="mt-0.5 truncate text-xs text-muted">{rule.description}</p>
        </div>
        {open ? <ChevronDown className="h-4 w-4 text-muted" /> : <ChevronRight className="h-4 w-4 text-muted" />}
      </button>
      {open && rule.issues.length > 0 && (
        <ul className="max-h-64 space-y-1 overflow-y-auto border-t border-border px-4 py-2">
          {rule.issues.map((issue, i) => (
            <li key={i} className="rounded px-2 py-1.5 text-xs hover:bg-surface">
              <button
                className="flex w-full items-start gap-2 text-left"
                disabled={issue.guids.length === 0}
                onClick={() => onFocus(issue.guids)}
                title={issue.guids.length > 0 ? "在 3D 视图中定位" : undefined}
              >
                {issue.guids.length > 0 && <Crosshair className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />}
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
          ))}
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
    <div className="rounded-lg border border-border bg-surface2 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">AI Suggestions（AI 生成改进建议）</p>
          <p className="mt-0.5 text-xs text-muted">基于质检结果，由 AI 输出面向非技术用户的 3 条中文改进建议</p>
        </div>
        <button
          onClick={() => void ask()}
          disabled={state.status === "loading"}
          className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-black hover:opacity-90 disabled:opacity-50"
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

interface Props {
  report: QaReport;
  modelName: string;
  onFocus: (guids: string[]) => void;
}

export default function ReportView({ report, modelName, onFocus }: Props) {
  const counts = useMemo(() => {
    const all = [...report.rules, ...report.privacy];
    return {
      errors: all.filter((r) => r.severity === "error" && r.affectedCount > 0).length,
      warnings: all.filter((r) => r.severity === "warning" && r.affectedCount > 0).length,
      infos: all.filter((r) => r.severity === "info" && r.affectedCount > 0).length,
    };
  }, [report]);

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center gap-6 rounded-xl border border-border bg-surface p-5">
          <HealthBadge score={report.healthScore} />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-semibold">{report.projectName}</h2>
            <p className="mt-0.5 text-xs text-muted">
              {report.schema} · {report.elementCount.toLocaleString()} 个构件 · 生成于{" "}
              {new Date(report.generatedAt).toLocaleString()}
            </p>
            <div className="mt-2 flex gap-4 text-xs">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-danger" /> {counts.errors} 错误</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-warning" /> {counts.warnings} 警告</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-accent" /> {counts.infos} 提示</span>
            </div>
          </div>
          <div className="flex shrink-0 flex-col gap-2">
            <button
              onClick={() => exportReportJson(report, modelName)}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-surface2"
            >
              <Download className="h-3.5 w-3.5" /> Export JSON
            </button>
            <button
              onClick={() => exportReportCsv(report, modelName)}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-surface2"
            >
              <Download className="h-3.5 w-3.5" /> Export CSV
            </button>
          </div>
        </div>

        <section className="space-y-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">质检规则</h3>
          {report.rules.map((rule) => (
            <RuleCard key={rule.id} rule={rule} onFocus={onFocus} />
          ))}
        </section>

        <section className="space-y-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">信息泄露审计</h3>
          {report.privacy.map((rule) => (
            <RuleCard key={rule.id} rule={rule} onFocus={onFocus} />
          ))}
        </section>

        <AdviseSection report={report} />
      </div>
    </div>
  );
}
