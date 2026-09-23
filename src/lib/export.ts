import type { QaReport, RuleResult } from "./ifc/types";

function download(filename: string, content: string, mime: string) {
  const blob = new Blob(["\ufeff" + content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportReportJson(report: QaReport, modelName: string) {
  download(
    `${modelName.replace(/\.ifc$/i, "")}-qa-report.json`,
    JSON.stringify(report, null, 2),
    "application/json"
  );
}

const csvEscape = (v: string) => `"${v.replace(/"/g, '""')}"`;

function ruleRows(report: QaReport, rules: RuleResult[], category: string): string[] {
  const rows: string[] = [];
  for (const rule of rules) {
    if (rule.issues.length === 0) {
      rows.push(
        [category, rule.id, rule.name, rule.severity, "通过", "", ""].map(csvEscape).join(",")
      );
      continue;
    }
    for (const issue of rule.issues) {
      rows.push(
        [
          category,
          rule.id,
          rule.name,
          rule.severity,
          issue.message,
          issue.guids.join(";"),
          issue.detail ?? "",
        ]
          .map(csvEscape)
          .join(",")
      );
    }
  }
  return rows;
}

export function exportReportCsv(report: QaReport, modelName: string) {
  const header = ["类别", "规则ID", "规则名称", "严重级别", "问题描述", "受影响GUID", "详情"]
    .map(csvEscape)
    .join(",");
  const meta = [
    `# 项目: ${report.projectName}`,
    `Schema: ${report.schema}`,
    `构件数: ${report.elementCount}`,
    `健康分: ${report.healthScore}`,
    `生成时间: ${report.generatedAt}`,
  ]
    .map((l) => csvEscape(l))
    .join("\n");
  const rows = [...ruleRows(report, report.rules, "质检"), ...ruleRows(report, report.privacy, "隐私审计")];
  download(
    `${modelName.replace(/\.ifc$/i, "")}-qa-report.csv`,
    [meta, header, ...rows].join("\n"),
    "text/csv"
  );
}
