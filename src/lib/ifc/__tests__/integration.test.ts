import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { extractModelData, parseHeader } from "../model";
import { runAllRules } from "../rules";
import { runPrivacyAudit } from "../privacy";

const samplePath = join(__dirname, "../../../../public/samples/sample.ifc");
const bytes = new Uint8Array(readFileSync(samplePath));

describe("extractModelData (integration with real IFC sample)", () => {
  it("extracts schema, project and elements", async () => {
    const data = await extractModelData(bytes);
    expect(data.schema).toBe("IFC2X3");
    expect(data.projectName).toContain("project");
    expect(data.elements.length).toBeGreaterThan(0);
    // walls in this sample carry real geometry
    const walls = data.elements.filter((e) => e.type === "IfcWall");
    expect(walls.length).toBeGreaterThan(0);
    expect(walls.every((w) => w.hasGeometry)).toBe(true);
    // property sets were mapped via IfcRelDefinesByProperties
    expect(data.elements.some((e) => e.psets.length > 0)).toBe(true);
    // units
    expect(data.units.lengthUnit).toContain("METRE");
    expect(data.units.contexts.length).toBeGreaterThan(0);
    // every rooted entity has a GUID
    expect(data.rootedEntities.length).toBeGreaterThan(data.elements.length);
    // header parsed
    expect(data.header.schema).toContain("IFC2X3");
  }, 60000);

  it("runs all QA rules and privacy audit without errors", async () => {
    const data = await extractModelData(bytes);
    const rules = await runAllRules(data);
    expect(rules).toHaveLength(6);
    for (const r of rules) {
      expect(["error", "warning", "info"]).toContain(r.severity);
      expect(r.name.length).toBeGreaterThan(0);
    }
    const privacy = await runPrivacyAudit(data);
    expect(privacy).toHaveLength(4);
    // this sample embeds a person ("Jan B.") so personal info should fire
    const personal = privacy.find((p) => p.id === "privacy-personal");
    expect(personal).toBeDefined();
  }, 60000);
});

describe("parseHeader", () => {
  it("parses FILE_NAME and FILE_SCHEMA fields", () => {
    const h = parseHeader(bytes);
    expect(h.schema).toContain("IFC2X3");
    expect(h.timeStamp.length).toBeGreaterThan(0);
  });
});
