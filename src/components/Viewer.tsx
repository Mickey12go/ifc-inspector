import { memo, useEffect, useRef } from "react";
import { Loader2, AlertTriangle } from "lucide-react";
import type { IfcViewer } from "../lib/viewer";

export type LoadState =
  | { status: "empty" }
  | { status: "loading"; message: string }
  | { status: "ready" }
  | { status: "error"; message: string };

interface Props {
  viewerRef: React.MutableRefObject<IfcViewer | null>;
  readyRef: React.MutableRefObject<Promise<void> | null>;
  state: LoadState;
}

/**
 * Memoized so report/selection re-renders never touch the 3D scene.
 * Scene init + render loop live in a mount-only effect; highlight changes
 * are pushed into the viewer imperatively via viewerRef.
 */
const Viewer = memo(function Viewer({ viewerRef, readyRef, state }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let disposed = false;
    readyRef.current = (async () => {
      const { IfcViewer } = await import("../lib/viewer");
      if (disposed || !containerRef.current) return;
      const viewer = new IfcViewer();
      viewerRef.current = viewer;
      await viewer.init(containerRef.current);
    })();
    return () => {
      disposed = true;
      viewerRef.current?.dispose();
      viewerRef.current = null;
    };
  }, [viewerRef, readyRef]);

  return (
    <div className="absolute inset-0 overflow-hidden bg-background">
      <div ref={containerRef} className="absolute inset-0" />
      {state.status === "loading" && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-background/80 backdrop-blur-sm">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
          <p className="text-sm text-muted">{state.message}</p>
        </div>
      )}
      {state.status === "error" && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-background/80">
          <AlertTriangle className="h-8 w-8 text-danger" />
          <p className="text-sm font-medium">Failed to parse IFC file</p>
          <p className="max-w-md text-center text-xs text-muted">{state.message}</p>
        </div>
      )}
    </div>
  );
});

export default Viewer;
