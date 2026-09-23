import { describe, expect, it } from "vitest";
import type { IfcElementData, IfcModelData } from "../types";
import {
  checkDuplicateGuids,
  checkEmptyGeometry,
  checkMissingPsets,
  checkNaming,
  computeHealthScore,
  DEFAULT_RULE_CONFIG,
} from "../rules";

function el(partial: Partial<IfcElementData> & { guid: string }): IfcElementData {
  return {
    expressID: 1,
    type: "IfcWall",
    name: "Wall-L1-001",
    description: "desc",
    hasGeometry: true,
    psets: ["Pset_WallCommon"],
    ...partial,
  };
}

function model(partial: Partial<IfcModelData>): IfcModelData {
  return {
    schema: "IFC2X3",
    projectName: "Test",
    elements: [],
    rootedEntities: [],
    stringValues: [],
    persons: [],
    organizations: [],
    header: {
      fileDescription: "",
      fileName: "",
      timeStamp: "",
      author: "",
      organization: "",
      preprocessorVersion: "",
      originatingSystem: "",
      authorization: "",
      schema: "IFC2X3",
    },
    units: { lengthUnit: "METRE (MILLI)", angleUnit: "RADIAN", contexts: ["Model/Body"], hasWorldCoordinateSystem: true },
    ...partial,
  };
}

describe("checkDuplicateGuids", () => {
  it("passes when all GUIDs are unique", () => {
    const data = model({
      rootedEntities: [
        { expressID: 1, type: "IfcWall", guid: "AAA" },
        { expressID: 2, type: "IfcSlab", guid: "BBB" },
      ],
    });
    const result = checkDuplicateGuids(data);
    expect(result.affectedCount).toBe(0);
    expect(result.severity).toBe("error");
  });

  it("flags GUIDs used by more than one entity", () => {
    const data = model({
      rootedEntities: [
        { expressID: 1, type: "IfcWall", guid: "DUP" },
        { expressID: 2, type: "IfcSlab", guid: "DUP" },
        { expressID: 3, type: "IfcDoor", guid: "OK" },
      ],
    });
    const result = checkDuplicateGuids(data);
    expect(result.affectedCount).toBe(1);
    expect(result.issues[0].guids).toEqual(["DUP"]);
    expect(result.issues[0].message).toContain("2 个实体");
  });
});

describe("checkNaming", () => {
  it("flags empty Name as warning and skips spatial elements", () => {
    const data = model({
      elements: [
        el({ guid: "G1", name: "", description: "d" }),
        el({ guid: "G2", type: "IfcBuildingStorey", name: "" }),
        el({ guid: "G3", name: "Wall-L1-003" }),
      ],
    });
    const [emptyRule, patternRule] = checkNaming(data);
    expect(emptyRule.affectedCount).toBe(1);
    expect(emptyRule.issues[0].guids).toEqual(["G1"]);
    expect(emptyRule.severity).toBe("warning");
    expect(patternRule.affectedCount).toBe(0);
  });

  it("flags names not matching 类型-楼层-编号 as info", () => {
    const data = model({
      elements: [el({ guid: "G1", name: "Basic Wall" }), el({ guid: "G2", name: "Slab-L2-015" })],
    });
    const [, patternRule] = checkNaming(data);
    expect(patternRule.severity).toBe("info");
    expect(patternRule.affectedCount).toBe(1);
    expect(patternRule.issues[0].guids).toEqual(["G1"]);
  });

  it("respects a custom naming pattern", () => {
    const data = model({ elements: [el({ guid: "G1", name: "WALL_001" })] });
    const [, patternRule] = checkNaming(data, {
      ...DEFAULT_RULE_CONFIG,
      namingPattern: /^WALL_\d+$/,
    });
    expect(patternRule.affectedCount).toBe(0);
  });
});

describe("checkMissingPsets", () => {
  it("flags elements missing the required pset", () => {
    const data = model({
      elements: [
        el({ guid: "G1", psets: [] }),
        el({ guid: "G2", psets: ["Pset_WallCommon"] }),
        el({ guid: "G3", type: "IfcFurnishingElement", psets: [] }),
      ],
    });
    const result = checkMissingPsets(data);
    expect(result.affectedCount).toBe(1);
    expect(result.issues[0].guids).toEqual(["G1"]);
  });
});

describe("checkEmptyGeometry", () => {
  it("flags physical elements without representation", () => {
    const data = model({
      elements: [
        el({ guid: "G1", hasGeometry: false }),
        el({ guid: "G2", hasGeometry: true }),
        el({ guid: "G3", type: "IfcSpace", hasGeometry: false }),
      ],
    });
    const result = checkEmptyGeometry(data);
    expect(result.severity).toBe("error");
    expect(result.affectedCount).toBe(1);
    expect(result.issues[0].guids).toEqual(["G1"]);
  });
});

describe("computeHealthScore", () => {
  it("returns 100 for a clean model and deducts for issues", () => {
    expect(computeHealthScore([])).toBe(100);
    const clean = checkDuplicateGuids(model({}));
    expect(computeHealthScore([clean])).toBe(100);
    const dup = checkDuplicateGuids(
      model({
        rootedEntities: [
          { expressID: 1, type: "IfcWall", guid: "X" },
          { expressID: 2, type: "IfcSlab", guid: "X" },
        ],
      })
    );
    expect(computeHealthScore([dup])).toBeLessThan(100);
    expect(computeHealthScore([dup])).toBeGreaterThanOrEqual(0);
  });
});
