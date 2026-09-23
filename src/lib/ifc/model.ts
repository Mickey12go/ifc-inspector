import { IfcAPI, IFCGEOMETRICREPRESENTATIONCONTEXT, IFCORGANIZATION, IFCPERSON, IFCPROJECT, IFCRELDEFINESBYPROPERTIES, IFCSIUNIT, IFCCONVERSIONBASEDUNIT } from "web-ifc";
import type { IfcHeaderInfo, IfcModelData, IfcStringValue, IfcUnitsInfo } from "./types";

let apiPromise: Promise<IfcAPI> | null = null;

export function getIfcApi(): Promise<IfcAPI> {
  if (!apiPromise) {
    apiPromise = (async () => {
      const api = new IfcAPI();
      // Browser: wasm is served from <base>/wasm (copied to public/). Node (tests): resolve next to the module.
      api.SetWasmPath(typeof window === "undefined" ? "" : `${import.meta.env.BASE_URL}wasm/`);
      await api.Init();
      return api;
    })();
  }
  return apiPromise;
}

const yieldToUi = () => new Promise<void>((r) => setTimeout(r, 0));

/** Types that define the spatial decomposition tree (no geometry required). */
const SPATIAL_TYPES = new Set([
  "IfcProject",
  "IfcSite",
  "IfcBuilding",
  "IfcBuildingStorey",
  "IfcSpace",
  "IfcExternalSpatialElement",
  "IfcSpatialZone",
]);

/** Walk a flattened web-ifc line and collect every string attribute. */
function collectStrings(
  node: unknown,
  path: string,
  guid: string,
  out: IfcStringValue[],
  depth: number
): void {
  if (depth > 6 || out.length > 20000 || node == null) return;
  if (Array.isArray(node)) {
    for (const item of node) collectStrings(item, path, guid, out, depth + 1);
    return;
  }
  if (typeof node === "object") {
    const rec = node as Record<string, unknown>;
    if (typeof rec.value === "string" && typeof rec.type === "number") {
      if (rec.value.length > 0) out.push({ guid, path, value: rec.value });
      return;
    }
    for (const [k, v] of Object.entries(rec)) {
      if (k === "expressID") continue;
      collectStrings(v, path ? `${path}.${k}` : k, guid, out, depth + 1);
    }
  }
}

/** Parse the HEADER section directly from the raw STEP text. */
export function parseHeader(bytes: Uint8Array): IfcHeaderInfo {
  const text = new TextDecoder("latin1").decode(bytes.slice(0, 16384));
  const headerMatch = text.match(/HEADER;([\s\S]*?)ENDSEC;/i);
  const header = headerMatch ? headerMatch[1] : "";
  const grab = (name: string) => {
    const m = header.match(new RegExp(`${name}\\((.*?)\\);`, "is"));
    return m ? m[1] : "";
  };
  const fileDesc = grab("FILE_DESCRIPTION");
  const fileName = grab("FILE_NAME");
  const fileSchema = grab("FILE_SCHEMA");
  const strings = [...fileName.matchAll(/'((?:[^']|'')*)'/g)].map((m) => m[1].replace(/''/g, "'"));
  // FILE_NAME('name','time_stamp',('author'),('organization'),'preprocessor','originating_system','authorization')
  const firstList = fileName.match(/\(([^)]*)\)/);
  const descImpl = fileDesc.match(/\(([^)]*)\)/);
  return {
    fileDescription: descImpl ? descImpl[1].replace(/'/g, "") : "",
    fileName: strings[0] ?? "",
    timeStamp: strings[1] ?? "",
    author: firstList ? firstList[1].replace(/'/g, "").trim() : "",
    organization: "",
    preprocessorVersion: strings[2] ?? "",
    originatingSystem: strings[3] ?? "",
    authorization: strings[4] ?? "",
    schema: (fileSchema.match(/'([^']+)'/)?.[1] ?? "").replace(/[()]/g, ""),
  };
}

export type ProgressFn = (fraction: number, label: string) => void;

/**
 * Extracts the full model dataset used by the QA rules and privacy audit.
 * Runs chunked with yields so the UI thread stays responsive on large files.
 */
export async function extractModelData(bytes: Uint8Array, onProgress?: ProgressFn): Promise<IfcModelData> {
  const api = await getIfcApi();
  const header = parseHeader(bytes);
  const modelID = api.OpenModel(bytes);
  try {
    onProgress?.(0.05, "Reading schema and project…");
    const schema = api.GetModelSchema(modelID) || header.schema;

    let projectName = "Unnamed project";
    const projects = api.GetLineIDsWithType(modelID, IFCPROJECT);
    if (projects.size() > 0) {
      const p = api.GetLine(modelID, projects.get(0), true);
      if (p?.Name?.value) projectName = String(p.Name.value);
    }

    // ---- Property set assignments: IfcRelDefinesByProperties ----
    onProgress?.(0.1, "Mapping property sets…");
    const psetsByExpressId = new Map<number, string[]>();
    const relIds = api.GetLineIDsWithType(modelID, IFCRELDEFINESBYPROPERTIES);
    for (let i = 0; i < relIds.size(); i++) {
      if (i % 25 === 0) await yieldToUi();
      const rel = api.GetLine(modelID, relIds.get(i), true);
      if (!rel || !Array.isArray(rel.RelatedObjects)) continue;
      // flattened lines inline referenced entities, so the pset name is directly available
      const psetName = rel.RelatingPropertyDefinition?.Name?.value
        ? String(rel.RelatingPropertyDefinition.Name.value)
        : "";
      if (!psetName) continue;
      for (const obj of rel.RelatedObjects) {
        const id = obj?.expressID;
        if (typeof id !== "number") continue;
        const list = psetsByExpressId.get(id);
        if (list) list.push(psetName);
        else psetsByExpressId.set(id, [psetName]);
      }
    }

    // ---- Main pass: every entity type in the model ----
    const elements: IfcModelData["elements"] = [];
    const rootedEntities: IfcModelData["rootedEntities"] = [];
    const stringValues: IfcStringValue[] = [];
    const units: IfcUnitsInfo = { lengthUnit: "UNKNOWN", angleUnit: "UNKNOWN", contexts: [], hasWorldCoordinateSystem: false };

    const types = api.GetAllTypesOfModel(modelID);
    let processedTypes = 0;
    for (const t of types) {
      processedTypes++;
      onProgress?.(0.15 + 0.7 * (processedTypes / types.length), `Extracting ${t.typeName}…`);
      await yieldToUi();

      if (t.typeID === IFCSIUNIT || t.typeID === IFCCONVERSIONBASEDUNIT) {
        const ids = api.GetLineIDsWithType(modelID, t.typeID);
        for (let i = 0; i < ids.size(); i++) {
          const u = api.GetLine(modelID, ids.get(i), true);
          const unitType = u?.UnitType?.value;
          const name = u?.Name?.value;
          const prefix = u?.Prefix?.value;
          if (unitType === "LENGTHUNIT" && name) {
            units.lengthUnit = prefix ? `${String(name)} (${String(prefix)})` : String(name);
          } else if (unitType === "PLANEANGLEUNIT" && name) {
            units.angleUnit = String(name);
          }
        }
        continue;
      }

      if (t.typeID === IFCGEOMETRICREPRESENTATIONCONTEXT) {
        const ids = api.GetLineIDsWithType(modelID, t.typeID);
        for (let i = 0; i < ids.size(); i++) {
          const c = api.GetLine(modelID, ids.get(i), true);
          const ct = c?.ContextType?.value;
          const ci = c?.ContextIdentifier?.value;
          if (ct) units.contexts.push(ci ? `${ct}/${ci}` : String(ct));
          if (c?.WorldCoordinateSystem) units.hasWorldCoordinateSystem = true;
        }
        continue;
      }

      if (t.typeName.startsWith("IfcRel")) continue;

      const ids = api.GetLineIDsWithType(modelID, t.typeID);
      const count = ids.size();
      if (count === 0) continue;
      const isRoot = t.typeName.startsWith("Ifc");
      for (let i = 0; i < count; i++) {
        if (i % 200 === 199) await yieldToUi();
        const expressID = ids.get(i);
        const line = api.GetLine(modelID, expressID, true);
        if (!line) continue;
        const guid = line.GlobalId?.value ? String(line.GlobalId.value) : null;

        if (t.typeID === IFCPERSON) {
          continue; // handled below
        }
        if (t.typeID === IFCORGANIZATION) {
          continue;
        }

        if (guid && isRoot) {
          rootedEntities.push({ expressID, type: t.typeName, guid });
          collectStrings(line, t.typeName, guid, stringValues, 0);

          const isProduct =
            SPATIAL_TYPES.has(t.typeName) ||
            ("ObjectType" in line || "Representation" in line) && !t.typeName.endsWith("Type");
          if (isProduct) {
            const hasGeometry =
              !SPATIAL_TYPES.has(t.typeName) &&
              line.Representation != null &&
              (!Array.isArray(line.Representation.Representations) ||
                line.Representation.Representations.length > 0);
            elements.push({
              expressID,
              type: t.typeName,
              guid,
              name: line.Name?.value ? String(line.Name.value) : "",
              description: line.Description?.value ? String(line.Description.value) : "",
              hasGeometry,
              psets: psetsByExpressId.get(expressID) ?? [],
            });
          }
        }
      }
    }

    // ---- Persons & organizations ----
    onProgress?.(0.88, "Reading persons and organizations…");
    const persons: IfcModelData["persons"] = [];
    const personIds = api.GetLineIDsWithType(modelID, IFCPERSON);
    for (let i = 0; i < personIds.size(); i++) {
      const id = personIds.get(i);
      const p = api.GetLine(modelID, id, true);
      if (!p) continue;
      const roles: string[] = [];
      if (Array.isArray(p.Roles)) {
        for (const r of p.Roles) {
          // flattened lines inline the IfcActorRole entity
          if (r?.Role?.value) roles.push(String(r.Role.value));
        }
      }
      persons.push({
        id: `#${id}`,
        familyName: p.FamilyName?.value ? String(p.FamilyName.value) : "",
        givenName: p.GivenName?.value ? String(p.GivenName.value) : "",
        roles,
      });
    }
    const organizations: IfcModelData["organizations"] = [];
    const orgIds = api.GetLineIDsWithType(modelID, IFCORGANIZATION);
    for (let i = 0; i < orgIds.size(); i++) {
      const id = orgIds.get(i);
      const o = api.GetLine(modelID, id, true);
      if (!o) continue;
      organizations.push({
        id: `#${id}`,
        name: o.Name?.value ? String(o.Name.value) : "",
        description: o.Description?.value ? String(o.Description.value) : "",
        roles: [],
      });
    }

    onProgress?.(1, "Extraction complete");
    return {
      schema,
      projectName,
      elements,
      rootedEntities,
      stringValues,
      persons,
      organizations,
      header,
      units,
    };
  } finally {
    api.CloseModel(modelID);
  }
}
