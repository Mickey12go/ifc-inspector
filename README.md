# IFC Inspector

Browser-only IFC model QA & privacy-leak audit tool for AEC deliverables.
Drag in an `.ifc` file — parsing, 3D visualization, QA rule scanning and privacy
auditing all happen **locally in your browser** (WebAssembly). No file content
ever touches a backend server.

## Features

- **F1 — Upload & 3D preview**: drag-and-drop `.ifc`, rendered with
  `@thatopen/components` (web-ifc → fragments → Three.js). Orbit / zoom / pan.
  Sidebar shows project name, IFC schema, element counts by IFC type.
  A bundled sample model (`public/samples/sample.ifc`, buildingSMART
  Certification-datasets, IFC2X3) lets you demo everything without a file.
- **F2 — QA rule engine** (pure functions in `src/lib/ifc/`, unit-tested):
  1. Duplicate GlobalId detection → error
  2. Missing required property sets (Pset_WallCommon etc., configurable) → warning
  3. Naming: empty Name/Description → warning; pattern `类型-楼层-编号` (regex configurable) → info
  4. Empty geometry (no Representation) → error
  5. Units & geometric context summary → info
- **F3 — Privacy leak audit**: persons/organizations, emails/phones in string
  attributes, Windows/UNC path leaks, long free-text review, file-header
  metadata (exporter, timestamp, author) with risk hints and fix suggestions.
- **F4 — Report & export**: health score (0–100), red/yellow/green rule status,
  grouped issue lists. **Click an issue to highlight & zoom to the element in
  the 3D viewport.** One-click export as JSON and CSV.
- **F5 — AI advice**: report-page button posts the report to `/api/advise`
  (Vercel serverless function → Kimi/Moonshot Chat Completions API, model `kimi-k3`)
  and returns 3 plain-Chinese suggestions for non-technical users.

## Tech stack

Vite + React 18 + TypeScript · @thatopen/components v3 · web-ifc · Three.js ·
Tailwind CSS · lucide-react · Vitest

> ⚠️ `web-ifc` is pinned to exactly `0.0.77` (not `^0.0.77`). The
> `@thatopen/fragments` worker is compiled against that exact WASM ABI —
> running `0.0.78` fails at load time with
> `function StreamMeshes called with 4 arguments, expected 3`.
> If you bump web-ifc, re-copy `node_modules/web-ifc/*.wasm` into
> `public/wasm/` and verify a model loads.

## Run locally

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build → dist/
npm test           # Vitest unit + integration tests
```

> The AI button needs the `/api/advise` serverless function, which only exists
> when deployed (or via `vercel dev`). Without it the button shows a friendly
> fallback message — everything else works fully offline.

## Deploy to Vercel

1. Push this repo to GitHub/GitLab and import it in Vercel.
2. Framework preset: **Vite** (build `npm run build`, output `dist`) — zero
   extra config needed; `api/advise.ts` is picked up automatically as a
   serverless function.
3. (Optional, for F5) Project → Settings → Environment Variables:
   add `KIMI_API_KEY` = your key. The key is only read server-side in
   `api/advise.ts`; it never appears in frontend code or git history.
   Without it the AI button shows "未配置 API Key" instead of failing.

Netlify works too for the static app (publish `dist`), but `/api/advise`
would need to be ported to a Netlify Function.

## Project layout

```
api/advise.ts              Vercel serverless function (Kimi Chat Completions API)
public/samples/sample.ifc  Built-in demo model (buildingSMART, IFC2X3)
public/wasm/               web-ifc WASM binaries
src/
  lib/
    ifc/
      model.ts             web-ifc extraction → IfcModelData (chunked, async)
      rules.ts             F2 QA rules (pure functions over IfcModelData)
      privacy.ts           F3 privacy audit rules (pure functions)
      types.ts             shared data structures
      __tests__/           Vitest unit + real-sample integration tests
    viewer.ts              @thatopen/components viewer + GUID highlight/focus
    export.ts              JSON / CSV report download
  components/              UI (UploadZone, InfoPanel, Viewer, ReportView)
  App.tsx                  orchestration, scan progress, view switching
```

## Rule configuration

Defaults live in `DEFAULT_RULE_CONFIG` (`src/lib/ifc/rules.ts`):
`requiredPsets` maps IFC type prefixes to required property set names, and
`namingPattern` is the `类型-楼层-编号` regex. Pass a custom `RuleConfig` to
`runAllRules` to override.

## Privacy note

The IFC file is parsed entirely in-browser via WebAssembly. The only network
call carrying report data is the optional "AI 生成改进建议" button, which sends
the QA **report JSON** (never the IFC file) to `/api/advise`.
