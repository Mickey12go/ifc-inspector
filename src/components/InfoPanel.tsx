import { useMemo } from "react";
import { Building2, Layers, Boxes, FileCode2 } from "lucide-react";
import type { IfcModelData } from "../lib/ifc/types";

interface Props {
  fileName: string;
  data: IfcModelData;
}

export default function InfoPanel({ fileName, data }: Props) {
  const countsByType = useMemo(() => {
    const map = new Map<string, number>();
    for (const el of data.elements) map.set(el.type, (map.get(el.type) ?? 0) + 1);
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [data]);

  return (
    <aside className="flex w-72 shrink-0 flex-col gap-4 overflow-y-auto border-r border-border bg-surface p-4">
      <div>
        <p className="text-xs uppercase tracking-wide text-muted">File</p>
        <p className="mt-0.5 break-all font-mono text-sm">{fileName}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-border bg-surface2 p-3">
          <div className="flex items-center gap-1.5 text-xs text-muted">
            <Building2 className="h-3.5 w-3.5" /> Project
          </div>
          <p className="mt-1 truncate text-sm font-medium" title={data.projectName}>
            {data.projectName}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-surface2 p-3">
          <div className="flex items-center gap-1.5 text-xs text-muted">
            <FileCode2 className="h-3.5 w-3.5" /> Schema
          </div>
          <p className="mt-1 text-sm font-medium">{data.schema}</p>
        </div>
        <div className="rounded-lg border border-border bg-surface2 p-3">
          <div className="flex items-center gap-1.5 text-xs text-muted">
            <Boxes className="h-3.5 w-3.5" /> Elements
          </div>
          <p className="mt-1 text-sm font-medium">{data.elements.length.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border border-border bg-surface2 p-3">
          <div className="flex items-center gap-1.5 text-xs text-muted">
            <Layers className="h-3.5 w-3.5" /> Length unit
          </div>
          <p className="mt-1 truncate text-sm font-medium" title={data.units.lengthUnit}>
            {data.units.lengthUnit}
          </p>
        </div>
      </div>
      <div className="min-h-0 flex-1">
        <p className="mb-2 text-xs uppercase tracking-wide text-muted">Elements by type</p>
        <div className="space-y-1">
          {countsByType.map(([type, count]) => (
            <div
              key={type}
              className="flex items-center justify-between rounded px-2 py-1 text-xs hover:bg-surface2"
            >
              <span className="font-mono text-foreground/90">{type}</span>
              <span className="text-muted">{count}</span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
