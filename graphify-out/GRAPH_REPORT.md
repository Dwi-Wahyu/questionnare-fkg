# Graph Report - /home/dwiwahyuilahi/Personal/Projects/FKG/tracert-study/source-code  (2026-07-19)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 367 nodes · 710 edges · 38 communities (16 shown, 22 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 13 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `b8fab1f4`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- seed.ts
- chart.tsx
- routeTree.gen.ts
- adminSurveyFunctions.ts
- surveys.index.tsx
- index.tsx
- 0000_brave_pixie.sql
- INSTRUKSI_MIGRASI_LUCIDE_ICONS.md
- Button.tsx
- cn
- Bun
- docs/chart/base.md
- 0001_cool_gorgon.sql
- 0002_tricky_black_tarantula.sql
- 0003_ambitious_wendell_rand.sql
- 0004_pale_vampiro.sql
- 0005_blue_mercury.sql
- 0006_striped_jamie_braddock.sql
- 0007_lush_sasquatch.sql
- Universitas Hasanuddin Logo
- Universitas Hasanuddin Favicon
- Universitas Hasanuddin Logo Public
- Rsbuild
- authFunctions.ts
- 0008_true_boomer.sql
- INSTRUKSI_IMPLEMENTASI_SURVEY.md
- FIX_SSE_AUTO_REFRESH.md
- SSE_LOG_ANALYSIS.md
- Dialog.tsx
- Input.tsx
- 09-individual-response-delete-print-and-csv-filter-fix.md

## God Nodes (most connected - your core abstractions)
1. `cn()` - 61 edges
2. `FileRoutesByPath` - 15 edges
3. `SurveyDetailComponent()` - 14 edges
4. `ChartTooltipContent()` - 10 edges
5. `ChartContainer()` - 9 edges
6. `Card()` - 8 edges
7. `CardHeader()` - 8 edges
8. `CardTitle()` - 8 edges
9. `CardDescription()` - 8 edges
10. `CardContent()` - 8 edges

## Surprising Connections (you probably didn't know these)
- `docs/chart/base.md` --conceptually_related_to--> `TanStack Start`  [INFERRED]
  docs/chart/base.md → AGENTS.md
- `CardAction()` --calls--> `cn()`  [EXTRACTED]
  src/components/ui/card.tsx → src/lib/utils.ts
- `assertAdmin()` --calls--> `getUserFromSession()`  [EXTRACTED]
  src/server/adminSurveyFunctions.ts → src/server/auth.ts
- `CommandEmpty()` --calls--> `cn()`  [EXTRACTED]
  src/components/ui/MultiSelect.tsx → src/lib/utils.ts
- `Card()` --calls--> `cn()`  [EXTRACTED]
  src/components/ui/card.tsx → src/lib/utils.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Project Tech Stack** — tanstack_start, rsbuild, bun [EXTRACTED 1.00]

## Communities (38 total, 22 thin omitted)

### Community 0 - "seed.ts"
Cohesion: 0.11
Nodes (29): getFormattedPeriod(), isSurveyExpired(), SurveyTakingComponent(), answers, questionOptions, questions, reportGenerations, responses (+21 more)

### Community 1 - "chart.tsx"
Cohesion: 0.15
Nodes (23): chartData, chartData, chartData, chartData, chartData, Card(), CardAction(), CardContent() (+15 more)

### Community 2 - "routeTree.gen.ts"
Cohesion: 0.05
Nodes (46): getRouter(), Register, @tanstack/react-router, ALL_SURVEYS, Route, Route, Route, Route (+38 more)

### Community 4 - "adminSurveyFunctions.ts"
Cohesion: 0.10
Nodes (33): useSurveyLive(), chartElementToPngBase64(), chartElementToPngBlob(), copyElementChartAsPng(), ChartCard(), formatAnswerForPrint(), pickChartKind(), safeKey() (+25 more)

### Community 5 - "surveys.index.tsx"
Cohesion: 0.20
Nodes (8): ConfirmDialog(), ConfirmDialogProps, Select(), SelectOption, SelectProps, Route, SurveysIndexComponent(), deleteAdminSurveyFn

### Community 6 - "index.tsx"
Cohesion: 0.19
Nodes (8): getAnchorAndDir(), hexToRgb(), LightRays(), Skeleton(), SkeletonProps, Route, getPublicLandingStatsFn, getPublishedSurveysFn

### Community 7 - "0000_brave_pixie.sql"
Cohesion: 0.54
Nodes (7): `answers`, `question_options`, `questions`, `responses`, `sections`, `surveys`, `users`

### Community 10 - "cn"
Cohesion: 0.06
Nodes (52): buttonVariants, Button(), Command(), CommandDialog(), CommandEmpty(), CommandGroup(), CommandInput(), CommandItem() (+44 more)

### Community 29 - "authFunctions.ts"
Cohesion: 0.08
Nodes (32): ToastContainer(), Listener, listeners, toast, toasts, ToastType, useToast(), AdminLayoutComponent() (+24 more)

## Knowledge Gaps
- **83 isolated node(s):** `chartData`, `chartData`, `chartData`, `chartData`, `chartData` (+78 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **22 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `cn` to `chart.tsx`?**
  _High betweenness centrality (0.236) - this node is a cross-community bridge._
- **Why does `ChartContainer()` connect `chart.tsx` to `cn`, `adminSurveyFunctions.ts`?**
  _High betweenness centrality (0.046) - this node is a cross-community bridge._
- **Why does `ChartTooltipContent()` connect `chart.tsx` to `cn`, `adminSurveyFunctions.ts`?**
  _High betweenness centrality (0.045) - this node is a cross-community bridge._
- **What connects `chartData`, `chartData`, `chartData` to the rest of the system?**
  _83 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `seed.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.10606060606060606 - nodes in this community are weakly interconnected._
- **Should `chart.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.14714714714714713 - nodes in this community are weakly interconnected._
- **Should `routeTree.gen.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05012531328320802 - nodes in this community are weakly interconnected._