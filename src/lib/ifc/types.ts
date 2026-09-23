export type Severity = "error" | "warning" | "info";

/** A single IFC product element (IfcProduct subtype), flattened for rule checks. */
export interface IfcElementData {
  expressID: number;
  type: string; // e.g. "IfcWall"
  guid: string;
  name: string;
  description: string;
  /** True when the element carries a geometric Representation. */
  hasGeometry: boolean;
  /** Names of property sets assigned to this element. */
  psets: string[];
}

/** Any IfcRoot entity that carries a GlobalId (products, psets, type objects…). */
export interface IfcRootEntity {
  expressID: number;
  type: string;
  guid: string;
}

export interface IfcStringValue {
  guid: string; // owning entity GUID ("" when unknown)
  path: string; // field path, e.g. "IfcPropertySingleValue.NominalValue"
  value: string;
}

export interface IfcHeaderInfo {
  fileDescription: string;
  fileName: string;
  timeStamp: string;
  author: string;
  organization: string;
  preprocessorVersion: string;
  originatingSystem: string;
  authorization: string;
  schema: string;
}

export interface IfcPersonInfo {
  id: string; // "#123"
  familyName: string;
  givenName: string;
  roles: string[];
}

export interface IfcOrganizationInfo {
  id: string;
  name: string;
  description: string;
  roles: string[];
}

/** Units / geometric context facts for the units rule. */
export interface IfcUnitsInfo {
  lengthUnit: string; // e.g. "METRE (MILLI)"
  angleUnit: string;
  contexts: string[]; // e.g. ["Model/Body", "Plan/Axis"]
  hasWorldCoordinateSystem: boolean;
}

/** Full extracted model dataset — the single input for all rules. */
export interface IfcModelData {
  schema: string;
  projectName: string;
  elements: IfcElementData[];
  rootedEntities: IfcRootEntity[];
  stringValues: IfcStringValue[];
  persons: IfcPersonInfo[];
  organizations: IfcOrganizationInfo[];
  header: IfcHeaderInfo;
  units: IfcUnitsInfo;
}

export interface RuleIssue {
  /** 中文问题描述 */
  message: string;
  /** Affected entity GUIDs */
  guids: string[];
  /** Optional extra detail shown in the UI (e.g. leaked snippet) */
  detail?: string;
}

export interface RuleResult {
  id: string;
  /** 中文规则名 */
  name: string;
  description: string;
  severity: Severity;
  issues: RuleIssue[];
  /** Total affected entity count */
  affectedCount: number;
}

export interface QaReport {
  generatedAt: string;
  schema: string;
  projectName: string;
  elementCount: number;
  healthScore: number;
  rules: RuleResult[];
  privacy: RuleResult[];
}
