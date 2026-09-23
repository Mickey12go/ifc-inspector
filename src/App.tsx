import { useCallback, useRef, useState } from "react";
import { ShieldCheck, FileUp, X, ScanSearch, ArrowLeft } from "lucide-react";
import UploadZone from "./components/UploadZone";
import Viewer, { type LoadState } from "./components/Viewer";
import InfoPanel from "./components/InfoPanel";
import { ReportPanel, WorkbenchToolbar, type IssueSelection } from "./components/ReportPanel";
import type { IfcViewer } from "./lib/viewer";
import type { IfcModelData, QaReport } from "./lib/ifc/types";

interface LoadedModel {
  name: string;
  bytes: Uint8Array;
  data: IfcModelData;
}

interface ScanState {
  active: boolean;
  fraction: number;
  label: string;
}

export default function App() {
  const viewerRef = useRef<IfcViewer | null>(null);
  const readyRef = useRef<Promise<void> | null>(null);
  const [state, setState] = useState<LoadState>({ status: "empty" });
  const [model, setModel] = useState<LoadedModel | null>(null);
  const [report, setReport] = useState<QaReport | null>(null);
  const [scan, setScan] = useState<ScanState>({ active: false, fraction: 0, label: "" });
  const [selected, setSelected] = useState<IssueSelection>(null);
  // narrow-screen tab: "issues" = report list, "3d" = viewport
  const [mobileTab, setMobileTab] = useState<"issues" | "3d">("3d");

  const loadBytes = useCallback(async (name: string, bytes: Uint8Array) => {
    setState({ status: "loading", message: "Extracting model data…" });
    try {
      const { extractModelData } = await import("./lib/ifc/model");
      const data = await extractModelData(bytes, (f, label) =>
        setState({ status: "loading", message: label })
      );

      setState({ status: "loading", message: "Building 3D geometry…" });
      await readyRef.current;
      if (!viewerRef.current) throw new Error("Viewer failed to initialize.");
      await viewerRef.current.loadModel(bytes, name);

      setModel({ name, bytes, data });
      setReport(null);
      setSelected(null);
      setMobileTab("3d");
      setState({ status: "ready" });
    } catch (err) {
      setState({
        status: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }, []);

  const loadFile = useCallback(
    async (file: File) => {
      const buf = new Uint8Array(await file.arrayBuffer());
      await loadBytes(file.name, buf);
    },
    [loadBytes]
  );

  const loadSample = useCallback(async () => {
    setState({ status: "loading", message: "Downloading sample model…" });
    const res = await fetch("/samples/sample.ifc");
    if (!res.ok) {
      setState({ status: "error", message: "Sample model not found." });
      return;
    }
    const buf = new Uint8Array(await res.arrayBuffer());
    await loadBytes("sample.ifc", buf);
  }, [loadBytes]);

  const reset = useCallback(async () => {
    await viewerRef.current?.unload();
    setModel(null);
    setReport(null);
    setSelected(null);
    setMobileTab("3d");
    setState({ status: "empty" });
  }, []);

  const runScan = useCallback(async () => {
    if (!model || scan.active) return;
    setScan({ active: true, fraction: 0, label: "准备扫描…" });
    try {
      const [{ runAllRules, computeHealthScore }, { runPrivacyAudit }] = await Promise.all([
        import("./lib/ifc/rules"),
        import("./lib/ifc/privacy"),
      ]);
      const rules = await runAllRules(model.data, undefined, (f, label) =>
        setScan({ active: true, fraction: f * 0.6, label })
      );
      const privacy = await runPrivacyAudit(model.data, (f, label) =>
        setScan({ active: true, fraction: 0.6 + f * 0.4, label })
      );
      setReport({
        generatedAt: new Date().toISOString(),
        schema: model.data.schema,
        projectName: model.data.projectName,
        elementCount: model.data.elements.length,
        healthScore: computeHealthScore(rules),
        rules,
        privacy,
      });
      setSelected(null);
      setMobileTab("issues"); // narrow screens land on the report first
    } finally {
      setScan({ active: false, fraction: 0, label: "" });
    }
  }, [model, scan.active]);

  const clearSelection = useCallback(async () => {
    setSelected(null);
    await viewerRef.current?.clearHighlight();
  }, []);

  const selectIssue = useCallback(
    (key: string, guids: string[]) => {
      // toggle off when clicking the already-selected issue
      if (selected?.key === key) {
        void clearSelection();
        return;
      }
      if (guids.length === 0) return;
      setSelected({ key, guids });
      void viewerRef.current?.highlightGuids(guids);
      setMobileTab("3d"); // narrow screens jump straight to the viewport
    },
    [selected, clearSelection]
  );

  const workbench = model !== null && report !== null;

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-surface px-5">
        <ShieldCheck className="h-5 w-5 text-accent" />
        <h1 className="text-sm font-semibold tracking-wide">IFC Inspector</h1>
        <span className="hidden rounded bg-surface2 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted sm:inline">
          QA &amp; Privacy Audit
        </span>
        <div className="ml-auto flex items-center gap-2">
          {model && (
            <>
              <span className="mr-2 hidden font-mono text-xs text-muted sm:inline">{model.name}</span>
              <button
                onClick={() => void runScan()}
                disabled={scan.active}
                className="flex items-center gap-1.5 rounded-lg border border-accent/50 px-3 py-1.5 text-xs font-semibold text-accent hover:bg-accent/10 disabled:opacity-50"
              >
                <ScanSearch className="h-3.5 w-3.5" />
                {report ? "Re-run Scan" : "Run QA Scan"}
              </button>
              <button
                onClick={() => void reset()}
                className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-surface2"
              >
                <X className="h-3.5 w-3.5" /> Close
              </button>
            </>
          )}
          <label className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-black hover:opacity-90">
            <FileUp className="h-3.5 w-3.5" /> Open IFC
            <input
              type="file"
              accept=".ifc"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void loadFile(f);
                e.target.value = "";
              }}
            />
          </label>
        </div>
      </header>

      {scan.active && (
        <div className="shrink-0 border-b border-border bg-surface px-5 py-2">
          <div className="flex items-center justify-between text-xs text-muted">
            <span>正在扫描：{scan.label}</span>
            <span>{Math.round(scan.fraction * 100)}%</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface2">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-200"
              style={{ width: `${Math.round(scan.fraction * 100)}%` }}
            />
          </div>
        </div>
      )}

      <main className="flex min-h-0 flex-1 flex-col">
        {workbench && (
          <WorkbenchToolbar
            report={report}
            modelName={model.name}
            hasSelection={selected !== null}
            onClear={() => void clearSelection()}
          />
        )}

        <div className="relative flex min-h-0 flex-1">
          {/* Report panel: left column on md+, full-screen overlay tab on narrow screens */}
          {workbench && (
            <aside
              className={
                mobileTab === "issues"
                  ? "absolute inset-0 z-20 flex flex-col bg-surface md:static md:z-auto md:w-2/5 md:min-w-[300px] md:max-w-[560px] md:border-r md:border-border"
                  : "hidden md:static md:flex md:w-2/5 md:min-w-[300px] md:max-w-[560px] md:flex-col md:border-r md:border-border md:bg-surface"
              }
            >
              {/* narrow-only tab header */}
              <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-2 md:hidden">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted">Issues 报告</span>
                <button
                  onClick={() => setMobileTab("3d")}
                  className="rounded-lg border border-border px-2.5 py-1 text-xs font-medium hover:bg-surface2"
                >
                  3D View →
                </button>
              </div>
              <ReportPanel report={report} selected={selected} onSelect={selectIssue} />
            </aside>
          )}

          {/* Model info sidebar (pre-scan, wide screens only) */}
          {model && !report && (
            <div className="hidden md:block">
              <InfoPanel fileName={model.name} data={model.data} />
            </div>
          )}

          {/* 3D viewport pane — always mounted */}
          <div className="relative min-h-0 min-w-0 flex-1">
            <Viewer viewerRef={viewerRef} readyRef={readyRef} state={state} />

            {/* narrow-only: floating back button after jumping from an issue */}
            {workbench && mobileTab === "3d" && (
              <button
                onClick={() => setMobileTab("issues")}
                className="absolute left-3 top-3 z-30 flex items-center gap-1.5 rounded-lg border border-border bg-surface/90 px-3 py-1.5 text-xs font-medium shadow-lg backdrop-blur md:hidden"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back to issues
              </button>
            )}

            {state.status === "empty" && (
              <div className="absolute inset-0 z-20 bg-background">
                <UploadZone onFile={(f) => void loadFile(f)} onSample={() => void loadSample()} />
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
