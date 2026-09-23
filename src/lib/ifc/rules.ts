import type { IfcModelData, RuleResult, Severity } from "./types";

export interface RuleConfig {
  /** Required property sets per IFC type (prefix-matched). */
  requiredPsets: Record<string, string[]>;
  /** Naming convention pattern applied to element Name. Default: 类型-楼层-编号 */
  namingPattern: RegExp;
}

export const DEFAULT_RULE_CONFIG: RuleConfig = {
  requiredPsets: {
    IfcWall: ["Pset_WallCommon"],
    IfcSlab: ["Pset_SlabCommon"],
    IfcDoor: ["Pset_DoorCommon"],
    IfcWindow: ["Pset_WindowCommon"],
    IfcBeam: ["Pset_BeamCommon"],
    IfcColumn: ["Pset_ColumnCommon"],
  },
  namingPattern: /^[^\s-]+-[^\s-]+-[^\s-]+$/,
};

const SPATIAL = new Set(["IfcProject", "IfcSite", "IfcBuilding", "IfcBuildingStorey", "IfcSpace"]);
const NON_PHYSICAL = new Set(["IfcZone", "IfcGroup", "IfcInventory", "IfcSystem"]);


function makeResult(
  id: string,
  name: string,
  description: string,
  severity: Severity,
  issues: RuleResult["issues"]
): RuleResult {
  return {
    id,
    name,
    description,
    severity,
    issues,
    affectedCount: issues.reduce((n, i) => n + i.guids.length, 0),
  };
}

/** Rule 1 — duplicate GlobalId detection. */
export function checkDuplicateGuids(data: IfcModelData): RuleResult {
  const byGuid = new Map<string, string[]>();
  for (const e of data.rootedEntities) {
    const list = byGuid.get(e.guid);
    if (list) list.push(e.type);
    else byGuid.set(e.guid, [e.type]);
  }
  const issues = [...byGuid.entries()]
    .filter(([, types]) => types.length > 1)
    .map(([guid, types]) => ({
      message: `GUID 被 ${types.length} 个实体重复使用（${types.join(", ")}）`,
      guids: [guid],
    }));
  return makeResult(
    "duplicate-guid",
    "GUID 重复检测",
    "IFC 全局唯一标识符（GlobalId）在整个模型中必须唯一，重复会导致构件追踪与协同出错。",
    "error",
    issues
  );
}

/** Rule 2 — missing required property sets. */
export function checkMissingPsets(
  data: IfcModelData,
  config: RuleConfig = DEFAULT_RULE_CONFIG
): RuleResult {
  const issues: RuleResult["issues"] = [];
  for (const el of data.elements) {
    const required = Object.entries(config.requiredPsets).find(([typePrefix]) =>
      el.type.startsWith(typePrefix)
    )?.[1];
    if (!required) continue;
    const missing = required.filter((pset) => !el.psets.includes(pset));
    if (missing.length > 0) {
      issues.push({
        message: `${el.type} "${el.name || "(unnamed)"}" 缺少属性集：${missing.join(", ")}`,
        guids: [el.guid],
      });
    }
  }
  return makeResult(
    "missing-psets",
    "属性集缺失检测",
    "关键构件类型应附带标准属性集（如 Pset_WallCommon），缺失会影响算量与数据交付。",
    "warning",
    issues
  );
}

/** Rule 3 — naming conventions. Returns two results: empty names (warning) + pattern violations (info). */
export function checkNaming(
  data: IfcModelData,
  config: RuleConfig = DEFAULT_RULE_CONFIG
): RuleResult[] {
  const unnamedIssues: RuleResult["issues"] = [];
  const patternIssues: RuleResult["issues"] = [];
  for (const el of data.elements) {
    if (SPATIAL.has(el.type)) continue;
    if (!el.name.trim() || !el.description.trim()) {
      const what = !el.name.trim() ? "Name" : "Description";
      unnamedIssues.push({
        message: `${el.type} 的 ${what} 为空`,
        guids: [el.guid],
      });
    } else if (!config.namingPattern.test(el.name.trim())) {
      patternIssues.push({
        message: `"${el.name}" 不符合「类型-楼层-编号」命名模式`,
        guids: [el.guid],
        detail: el.name,
      });
    }
  }
  return [
    makeResult(
      "naming-empty",
      "命名完整性检测",
      "构件的 Name / Description 字段不应为空，否则下游系统难以识别构件。",
      "warning",
      unnamedIssues
    ),
    makeResult(
      "naming-pattern",
      "命名规范检测",
      "构件名称建议遵循「类型-楼层-编号」模式（可通过正则配置）。",
      "info",
      patternIssues
    ),
  ];
}

/** Rule 4 — elements without geometric representation. */
export function checkEmptyGeometry(data: IfcModelData): RuleResult {
  const issues = data.elements
    .filter((el) => !SPATIAL.has(el.type) && !NON_PHYSICAL.has(el.type) && !el.hasGeometry)
    .map((el) => ({
      message: `${el.type} "${el.name || "(unnamed)"}" 缺少几何表示（Representation 为空）`,
      guids: [el.guid],
    }));
  return makeResult(
    "empty-geometry",
    "空几何检测",
    "实体构件应包含几何表示；空几何构件通常是导出错误或占位对象。",
    "error",
    issues
  );
}

/** Rule 5 — units & coordinate system facts. */
export function checkUnits(data: IfcModelData): RuleResult {
  const issues: RuleResult["issues"] = [];
  issues.push({
    message: `长度单位：${data.units.lengthUnit}；角度单位：${data.units.angleUnit}`,
    guids: [],
    detail: `几何上下文：${data.units.contexts.join(", ") || "无"}`,
  });
  if (!data.units.hasWorldCoordinateSystem) {
    issues.push({
      message: "未检测到 WorldCoordinateSystem，坐标定位可能不可靠",
      guids: [],
    });
  }
  if (data.units.lengthUnit === "UNKNOWN") {
    issues.push({ message: "未在 IfcProject.UnitsInContext 中声明长度单位", guids: [] });
  }
  return makeResult(
    "units-context",
    "单位与坐标检查",
    "列出模型声明的测量单位与几何上下文，便于核对交付标准。",
    "info",
    issues
  );
}

/** Run all QA rules, reporting progress per rule. */
export async function runAllRules(
  data: IfcModelData,
  config: RuleConfig = DEFAULT_RULE_CONFIG,
  onProgress?: (fraction: number, ruleName: string) => void
): Promise<RuleResult[]> {
  const steps: Array<[string, () => RuleResult | RuleResult[]]> = [
    ["GUID 重复检测", () => checkDuplicateGuids(data)],
    ["属性集缺失检测", () => checkMissingPsets(data, config)],
    ["命名规范检测", () => checkNaming(data, config)],
    ["空几何检测", () => checkEmptyGeometry(data)],
    ["单位与坐标检查", () => checkUnits(data)],
  ];
  const results: RuleResult[] = [];
  for (let i = 0; i < steps.length; i++) {
    onProgress?.(i / steps.length, steps[i][0]);
    await new Promise((r) => setTimeout(r, 0));
    const out = steps[i][1]();
    results.push(...(Array.isArray(out) ? out : [out]));
  }
  onProgress?.(1, "完成");
  return results;
}

/** Overall health score 0–100 from rule results. */
export function computeHealthScore(rules: RuleResult[]): number {
  let score = 100;
  for (const rule of rules) {
    const n = rule.affectedCount;
    if (n === 0) continue;
    if (rule.severity === "error") score -= Math.min(40, 10 + n * 2);
    else if (rule.severity === "warning") score -= Math.min(20, 5 + n * 0.5);
    else score -= Math.min(8, n * 0.2);
  }
  return Math.max(0, Math.round(score));
}
