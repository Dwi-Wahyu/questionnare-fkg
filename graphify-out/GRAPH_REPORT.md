# Graph Report - /home/dwiwahyuilahi/Personal/Projects/FKG/tracert-study/source-code  (2026-07-18)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 270 nodes · 522 edges · 31 communities (15 shown, 16 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 13 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `a6346d77`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- seed.ts
- chart.tsx
- routeTree.gen.ts
- useToast.ts
- adminSurveyFunctions.ts
- surveys.index.tsx
- authFunctions.ts
- 0000_brave_pixie.sql
- INSTRUKSI_MIGRASI_LUCIDE_ICONS.md
- Button.tsx
- Skeleton.tsx
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

## God Nodes (most connected - your core abstractions)
1. `cn()` - 15 edges
2. `FileRoutesByPath` - 13 edges
3. `SurveyDetailComponent()` - 12 edges
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
- `FileRoutesByPath` --references--> `Route`  [EXTRACTED]
  src/routeTree.gen.ts → src/routes/admin/route.tsx
- `FileRoutesByPath` --references--> `Route`  [EXTRACTED]
  src/routeTree.gen.ts → src/routes/admin/surveys.index.tsx
- `FileRoutesByPath` --references--> `Route`  [EXTRACTED]
  src/routeTree.gen.ts → src/routes/admin/surveys.new.tsx

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Project Tech Stack** — tanstack_start, rsbuild, bun [EXTRACTED 1.00]

## Communities (31 total, 16 thin omitted)

### Community 0 - "seed.ts"
Cohesion: 0.11
Nodes (28): getFormattedPeriod(), isSurveyExpired(), SurveyTakingComponent(), answers, questionOptions, questions, reportGenerations, responses (+20 more)

### Community 1 - "chart.tsx"
Cohesion: 0.14
Nodes (26): chartData, chartData, chartData, chartData, chartData, buttonVariants, Button(), Card() (+18 more)

### Community 2 - "routeTree.gen.ts"
Cohesion: 0.05
Nodes (41): getRouter(), Register, @tanstack/react-router, ALL_SURVEYS, Route, Route, Route, Route (+33 more)

### Community 3 - "useToast.ts"
Cohesion: 0.10
Nodes (20): Input(), InputProps, ToastContainer(), Listener, listeners, toast, toasts, ToastType (+12 more)

### Community 4 - "adminSurveyFunctions.ts"
Cohesion: 0.12
Nodes (29): chartElementToPngBase64(), chartElementToPngBlob(), copyElementChartAsPng(), ChartCard(), formatAnswerForPrint(), pickChartKind(), safeKey(), SurveyDetailComponent() (+21 more)

### Community 5 - "surveys.index.tsx"
Cohesion: 0.24
Nodes (8): ConfirmDialog(), ConfirmDialogProps, Select(), SelectOption, SelectProps, Route, SurveysIndexComponent(), deleteAdminSurveyFn

### Community 6 - "authFunctions.ts"
Cohesion: 0.15
Nodes (15): Dialog(), DialogProps, UserManagementComponent(), assertAdmin(), assertAdmin(), createUserFn, listUsersFn, toggleUserStatusFn (+7 more)

### Community 7 - "0000_brave_pixie.sql"
Cohesion: 0.54
Nodes (7): `answers`, `question_options`, `questions`, `responses`, `sections`, `surveys`, `users`

## Knowledge Gaps
- **71 isolated node(s):** `chartData`, `chartData`, `chartData`, `chartData`, `chartData` (+66 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **16 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `ChartContainer()` connect `chart.tsx` to `adminSurveyFunctions.ts`?**
  _High betweenness centrality (0.045) - this node is a cross-community bridge._
- **Why does `ChartTooltipContent()` connect `chart.tsx` to `adminSurveyFunctions.ts`?**
  _High betweenness centrality (0.042) - this node is a cross-community bridge._
- **What connects `chartData`, `chartData`, `chartData` to the rest of the system?**
  _71 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `seed.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.11088709677419355 - nodes in this community are weakly interconnected._
- **Should `chart.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.13821138211382114 - nodes in this community are weakly interconnected._
- **Should `routeTree.gen.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05333333333333334 - nodes in this community are weakly interconnected._
- **Should `useToast.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.10344827586206896 - nodes in this community are weakly interconnected._