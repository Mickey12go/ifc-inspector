import type { IfcModelData, RuleResult } from "./types";

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
// Require a leading +, parentheses, or separators to avoid matching long numeric IDs.
const PHONE_RE = /\+\d[\d\s().-]{6,}\d|\(\d{2,4}\)[\d\s.-]{5,}\d|\d{2,4}[\s.-]\d{2,4}[\s.-]\d{2,9}/;
/** Windows absolute paths, UNC network paths, macOS/Linux home paths. */
const PATH_RE = /(?:[a-zA-Z]:\\[^\s"',;]+|\\\\[^\s"',;\\]+\\[^\s"',;]+|\/(?:Users|home)\/[^\s"',;]+)/;
const LONG_TEXT_MIN = 200;

function truncate(s: string, n = 120): string {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

/** Privacy rule 1 — personal information in IfcPerson / IfcOrganization. */
export function auditPersonalInfo(data: IfcModelData): RuleResult {
  const issues: RuleResult["issues"] = [];
  for (const p of data.persons) {
    const name = [p.givenName, p.familyName].filter(Boolean).join(" ").trim();
    if (name) {
      issues.push({
        message: `包含个人姓名："${name}"`,
        guids: [],
        detail: `字段路径：IfcPerson ${p.id}；角色：${p.roles.join(", ") || "未声明"}。建议：交付前移除或匿名化 IfcPerson 记录。`,
      });
    }
  }
  for (const o of data.organizations) {
    if (o.name) {
      issues.push({
        message: `包含组织名称："${o.name}"`,
        guids: [],
        detail: `字段路径：IfcOrganization ${o.id}。建议：确认该组织信息是否允许对外披露。`,
      });
    }
  }
  // email / phone patterns inside any string attribute
  for (const s of data.stringValues) {
    if (EMAIL_RE.test(s.value) || PHONE_RE.test(s.value)) {
      issues.push({
        message: `字符串属性中疑似邮箱/电话："${truncate(s.value, 60)}"`,
        guids: s.guid ? [s.guid] : [],
        detail: `字段路径：${s.path}。建议：清除联系方式字段。`,
      });
    }
  }
  return {
    id: "privacy-personal",
    name: "个人信息审计",
    description: "IfcPerson / IfcOrganization 及各属性字段中可能包含姓名、邮箱、电话等个人信息。",
    severity: "warning",
    issues,
    affectedCount: issues.length,
  };
}

/** Privacy rule 2 — internal file path leakage. */
export function auditPathLeaks(data: IfcModelData): RuleResult {
  const issues: RuleResult["issues"] = [];
  const seen = new Set<string>();
  const headerStrings = [
    data.header.fileName,
    data.header.author,
    data.header.preprocessorVersion,
    data.header.originatingSystem,
  ];
  for (const value of headerStrings) {
    if (value && PATH_RE.test(value) && !seen.has(value)) {
      seen.add(value);
      issues.push({
        message: `文件头包含内部路径："${truncate(value, 80)}"`,
        guids: [],
        detail: "字段路径：HEADER/FILE_NAME。建议：重新导出时使用相对路径或清空文件名元数据。",
      });
    }
  }
  for (const s of data.stringValues) {
    const m = s.value.match(PATH_RE);
    if (m && !seen.has(s.value)) {
      seen.add(s.value);
      issues.push({
        message: `属性值包含内部路径："${truncate(m[0], 80)}"`,
        guids: s.guid ? [s.guid] : [],
        detail: `字段路径：${s.path}。建议：删除本地/网络路径引用，改用相对 URI。`,
      });
    }
  }
  return {
    id: "privacy-paths",
    name: "内部路径泄露",
    description: "Windows / 网络共享路径可能暴露内部目录结构、用户名或服务器名称。",
    severity: "error",
    issues,
    affectedCount: issues.length,
  };
}

/** Privacy rule 3 — long free-text values for manual review. */
export function auditFreeText(data: IfcModelData): RuleResult {
  const issues: RuleResult["issues"] = [];
  for (const s of data.stringValues) {
    if (s.value.length >= LONG_TEXT_MIN) {
      issues.push({
        message: `长文本字段（${s.value.length} 字符）需人工审阅`,
        guids: s.guid ? [s.guid] : [],
        detail: `字段路径：${s.path}。原文：${truncate(s.value, 300)}。建议：确认文本中无内部备注或敏感信息后放行。`,
      });
    }
  }
  return {
    id: "privacy-freetext",
    name: "注释与自由文本",
    description: "超长文本属性可能夹带内部备注、审校意见或其他敏感内容，列出原文供人工审阅。",
    severity: "info",
    issues,
    affectedCount: issues.length,
  };
}

/** Privacy rule 4 — file header metadata summary. */
export function auditMetadata(data: IfcModelData): RuleResult {
  const h = data.header;
  const facts: string[] = [];
  if (h.originatingSystem) facts.push(`导出软件：${h.originatingSystem}`);
  if (h.preprocessorVersion) facts.push(`预处理器：${h.preprocessorVersion}`);
  if (h.timeStamp) facts.push(`导出时间：${h.timeStamp}`);
  if (h.author) facts.push(`作者：${h.author}`);
  if (h.authorization) facts.push(`授权用户：${h.authorization}`);
  if (h.fileName) facts.push(`原始文件名：${h.fileName}`);
  const issues: RuleResult["issues"] =
    facts.length > 0
      ? [
          {
            message: `文件头元数据：${facts.join("；")}`,
            guids: [],
            detail:
              "字段路径：HEADER/FILE_NAME、FILE_DESCRIPTION。建议：对外交付前使用工具剥离导出软件版本、时间戳与作者信息。",
          },
        ]
      : [];
  return {
    id: "privacy-metadata",
    name: "元数据摘要",
    description: "IFC 文件头记录了导出软件、时间戳与作者，可用于推断内部工具链与人员。",
    severity: "info",
    issues,
    affectedCount: issues.length,
  };
}

/** Run all privacy audit checks. */
export async function runPrivacyAudit(
  data: IfcModelData,
  onProgress?: (fraction: number, ruleName: string) => void
): Promise<RuleResult[]> {
  const steps: Array<[string, () => RuleResult]> = [
    ["个人信息审计", () => auditPersonalInfo(data)],
    ["内部路径泄露", () => auditPathLeaks(data)],
    ["注释与自由文本", () => auditFreeText(data)],
    ["元数据摘要", () => auditMetadata(data)],
  ];
  const results: RuleResult[] = [];
  for (let i = 0; i < steps.length; i++) {
    onProgress?.(i / steps.length, steps[i][0]);
    await new Promise((r) => setTimeout(r, 0));
    results.push(steps[i][1]());
  }
  onProgress?.(1, "完成");
  return results;
}
