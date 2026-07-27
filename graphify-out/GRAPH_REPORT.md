# Graph Report - /home/dwiwahyuilahi/Personal/Projects/FKG/tracert-study/source-code  (2026-07-27)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 441 nodes · 845 edges · 54 communities (24 shown, 30 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 13 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `9a6b0c24`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- seed.ts
- chart.tsx
- routeTree.gen.ts
- index.tsx
- adminSurveyFunctions.ts
- surveys.index.tsx
- survey.$surveySlug.tsx
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
- useToast.ts
- 0008_true_boomer.sql
- INSTRUKSI_IMPLEMENTASI_SURVEY.md
- FIX_SSE_AUTO_REFRESH.md
- SSE_LOG_ANALYSIS.md
- index.tsx
- Dialog.tsx
- Input.tsx
- FIX_LIVE_PRESENCE_PRODUCTION.md
- 0013_sparkling_violations.sql
- surveys.new.tsx
- authFunctions.ts
- 0010_third_tarot.sql
- 09-individual-response-delete-print-and-csv-filter-fix.md
- 0009_flat_zarda.sql
- 03-FIX_SURVEY_TAKING_HOOKS_ERROR.md
- 04-IMPLEMENT_SURVEY_CATEGORY_TABLE.md
- Laporan Implementasi — Integrasi Auto-Isi Data SIAKAD ke TracerStudy
- `questions`
- router.tsx
- Visitor Statistics Implementation Summary
- 0011_mature_forgotten_one.sql

## God Nodes (most connected - your core abstractions)
1. `cn()` - 63 edges
2. `SurveyDetailComponent()` - 16 edges
3. `FileRoutesByPath` - 13 edges
4. `db` - 11 edges
5. `ChartTooltipContent()` - 10 edges
6. `ChartContainer()` - 9 edges
7. `SurveyTakingComponent()` - 9 edges
8. `getUserFromSession()` - 9 edges
9. `Card()` - 8 edges
10. `CardHeader()` - 8 edges

## Surprising Connections (you probably didn't know these)
- `docs/chart/base.md` --conceptually_related_to--> `TanStack Start`  [INFERRED]
  docs/chart/base.md → AGENTS.md
- `CardAction()` --calls--> `cn()`  [EXTRACTED]
  src/components/ui/card.tsx → src/lib/utils.ts
- `RootComponent()` --calls--> `logoutFn`  [EXTRACTED]
  src/routes/__root.tsx → src/server/authFunctions.ts
- `CommandEmpty()` --calls--> `cn()`  [EXTRACTED]
  src/components/ui/MultiSelect.tsx → src/lib/utils.ts
- `Badge()` --calls--> `cn()`  [EXTRACTED]
  src/components/ui/badge.tsx → src/lib/utils.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Project Tech Stack** — tanstack_start, rsbuild, bun [EXTRACTED 1.00]

## Communities (54 total, 30 thin omitted)

### Community 0 - "seed.ts"
Cohesion: 0.05
Nodes (59): SettingsComponent(), assertAdmin(), updateSurveyCategorySettingsFn, assertAdmin(), createUserFn, listUsersFn, toggleUserStatusFn, updateUserFn (+51 more)

### Community 1 - "chart.tsx"
Cohesion: 0.15
Nodes (23): chartData, chartData, chartData, chartData, chartData, Card(), CardAction(), CardContent() (+15 more)

### Community 2 - "routeTree.gen.ts"
Cohesion: 0.08
Nodes (30): Route, Route, Route, Route, Route, Route, Route, AdminAnalyticsRoute (+22 more)

### Community 3 - "index.tsx"
Cohesion: 0.20
Nodes (6): ALL_SURVEYS, Route, Route, getAdminDashboardStatsFn, getAdminSurveysListFn, getVisitorStatsFn

### Community 4 - "adminSurveyFunctions.ts"
Cohesion: 0.09
Nodes (37): chartElementToPngBase64(), chartElementToPngBlob(), copyElementChartAsPng(), ChartCard(), formatAnswerForPrint(), pickChartKind(), safeKey(), SurveyDetailComponent() (+29 more)

### Community 5 - "surveys.index.tsx"
Cohesion: 0.18
Nodes (9): ConfirmDialog(), ConfirmDialogProps, Select(), SelectOption, SelectProps, Route, SurveysIndexComponent(), deleteAdminSurveyFn (+1 more)

### Community 6 - "survey.$surveySlug.tsx"
Cohesion: 0.12
Nodes (24): Badge(), badgeVariants, useSurveyLive(), getFormattedPeriod(), isSurveyExpired(), SurveyTakingComponent(), g, getAggregatePresence() (+16 more)

### Community 7 - "0000_brave_pixie.sql"
Cohesion: 0.54
Nodes (7): `answers`, `question_options`, `questions`, `responses`, `sections`, `surveys`, `users`

### Community 10 - "cn"
Cohesion: 0.06
Nodes (52): buttonVariants, Button(), Command(), CommandDialog(), CommandEmpty(), CommandGroup(), CommandInput(), CommandItem() (+44 more)

### Community 29 - "useToast.ts"
Cohesion: 0.23
Nodes (7): ToastContainer(), Listener, listeners, toasts, ToastType, useToast(), RootComponent()

### Community 35 - "index.tsx"
Cohesion: 0.21
Nodes (7): getAnchorAndDir(), hexToRgb(), LightRays(), Skeleton(), SkeletonProps, getPublicLandingStatsFn, getPublishedSurveysFn

### Community 41 - "surveys.new.tsx"
Cohesion: 0.67
Nodes (3): CreateSurveyComponent(), Route, createAdminSurveyFn

### Community 42 - "authFunctions.ts"
Cohesion: 0.31
Nodes (8): toast, AdminLayoutComponent(), LoginComponent(), loginSchema, Route, getSessionFn, loginFn, logoutFn

### Community 48 - "Laporan Implementasi — Integrasi Auto-Isi Data SIAKAD ke TracerStudy"
Cohesion: 0.40
Nodes (4): Impact on Graph, Laporan Implementasi — Integrasi Auto-Isi Data SIAKAD ke TracerStudy, Logic Changes, Modified Files

### Community 52 - "router.tsx"
Cohesion: 0.33
Nodes (5): getRouter(), Register, @tanstack/react-router, Register, routeTree

### Community 53 - "Visitor Statistics Implementation Summary"
Cohesion: 0.40
Nodes (4): Impact on Graph, Logic Changes, Modified Files, Visitor Statistics Implementation Summary

## Knowledge Gaps
- **104 isolated node(s):** `chartData`, `chartData`, `chartData`, `chartData`, `chartData` (+99 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **30 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `cn` to `chart.tsx`, `survey.$surveySlug.tsx`?**
  _High betweenness centrality (0.183) - this node is a cross-community bridge._
- **Why does `ChartContainer()` connect `chart.tsx` to `cn`, `adminSurveyFunctions.ts`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **Why does `ChartTooltipContent()` connect `chart.tsx` to `cn`, `adminSurveyFunctions.ts`?**
  _High betweenness centrality (0.026) - this node is a cross-community bridge._
- **What connects `chartData`, `chartData`, `chartData` to the rest of the system?**
  _104 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `seed.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05228070175438596 - nodes in this community are weakly interconnected._
- **Should `chart.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.14714714714714713 - nodes in this community are weakly interconnected._
- **Should `routeTree.gen.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07765151515151515 - nodes in this community are weakly interconnected._