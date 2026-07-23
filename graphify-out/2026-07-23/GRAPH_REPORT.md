# Graph Report - /home/dwiwahyuilahi/Personal/Projects/FKG/tracert-study/source-code  (2026-07-23)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 425 nodes · 812 edges · 52 communities (24 shown, 28 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 13 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `ed21cc67`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- seed.ts
- chart.tsx
- routeTree.gen.ts
- visitorFunctions.ts
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
- surveys.new.tsx
- login.tsx
- 0010_third_tarot.sql
- 09-individual-response-delete-print-and-csv-filter-fix.md
- 0009_flat_zarda.sql
- 03-FIX_SURVEY_TAKING_HOOKS_ERROR.md
- 04-IMPLEMENT_SURVEY_CATEGORY_TABLE.md
- Laporan Implementasi — Integrasi Auto-Isi Data SIAKAD ke TracerStudy
- siakadClient.ts
- router.tsx
- Visitor Statistics Implementation Summary
- 0011_mature_forgotten_one.sql

## God Nodes (most connected - your core abstractions)
1. `cn()` - 63 edges
2. `SurveyDetailComponent()` - 16 edges
3. `FileRoutesByPath` - 13 edges
4. `ChartTooltipContent()` - 10 edges
5. `db` - 10 edges
6. `ChartContainer()` - 9 edges
7. `getUserFromSession()` - 9 edges
8. `Card()` - 8 edges
9. `CardHeader()` - 8 edges
10. `CardTitle()` - 8 edges

## Surprising Connections (you probably didn't know these)
- `docs/chart/base.md` --conceptually_related_to--> `TanStack Start`  [INFERRED]
  docs/chart/base.md → AGENTS.md
- `CardAction()` --calls--> `cn()`  [EXTRACTED]
  src/components/ui/card.tsx → src/lib/utils.ts
- `CommandEmpty()` --calls--> `cn()`  [EXTRACTED]
  src/components/ui/MultiSelect.tsx → src/lib/utils.ts
- `Card()` --calls--> `cn()`  [EXTRACTED]
  src/components/ui/card.tsx → src/lib/utils.ts
- `CardHeader()` --calls--> `cn()`  [EXTRACTED]
  src/components/ui/card.tsx → src/lib/utils.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Project Tech Stack** — tanstack_start, rsbuild, bun [EXTRACTED 1.00]

## Communities (52 total, 28 thin omitted)

### Community 0 - "seed.ts"
Cohesion: 0.07
Nodes (41): UserManagementComponent(), assertAdmin(), assertAdmin(), createUserFn, listUsersFn, toggleUserStatusFn, updateUserFn, createSessionToken() (+33 more)

### Community 1 - "chart.tsx"
Cohesion: 0.15
Nodes (23): chartData, chartData, chartData, chartData, chartData, Card(), CardAction(), CardContent() (+15 more)

### Community 2 - "routeTree.gen.ts"
Cohesion: 0.08
Nodes (30): Route, Route, Route, Route, Route, Route, Route, AdminAnalyticsRoute (+22 more)

### Community 3 - "visitorFunctions.ts"
Cohesion: 0.15
Nodes (10): ALL_SURVEYS, Route, getAdminDashboardStatsFn, getAdminSurveysListFn, getSessionFn, visitorLogs, getVisitorStatsFn, statsCache (+2 more)

### Community 4 - "adminSurveyFunctions.ts"
Cohesion: 0.09
Nodes (37): chartElementToPngBase64(), chartElementToPngBlob(), copyElementChartAsPng(), ChartCard(), formatAnswerForPrint(), pickChartKind(), safeKey(), SurveyDetailComponent() (+29 more)

### Community 5 - "surveys.index.tsx"
Cohesion: 0.18
Nodes (9): ConfirmDialog(), ConfirmDialogProps, Select(), SelectOption, SelectProps, Route, SurveysIndexComponent(), deleteAdminSurveyFn (+1 more)

### Community 6 - "survey.$surveySlug.tsx"
Cohesion: 0.15
Nodes (20): useSurveyLive(), getFormattedPeriod(), isSurveyExpired(), SurveyTakingComponent(), g, getAggregatePresence(), getLastActivity(), getPresenceCount() (+12 more)

### Community 7 - "0000_brave_pixie.sql"
Cohesion: 0.54
Nodes (7): `answers`, `question_options`, `questions`, `responses`, `sections`, `surveys`, `users`

### Community 10 - "cn"
Cohesion: 0.06
Nodes (54): Badge(), badgeVariants, buttonVariants, Button(), Command(), CommandDialog(), CommandEmpty(), CommandGroup() (+46 more)

### Community 29 - "useToast.ts"
Cohesion: 0.18
Nodes (10): ToastContainer(), Listener, listeners, toasts, ToastType, useToast(), AdminLayoutComponent(), Route (+2 more)

### Community 35 - "index.tsx"
Cohesion: 0.21
Nodes (7): getAnchorAndDir(), hexToRgb(), LightRays(), Skeleton(), SkeletonProps, getPublicLandingStatsFn, getPublishedSurveysFn

### Community 41 - "surveys.new.tsx"
Cohesion: 0.67
Nodes (3): CreateSurveyComponent(), Route, createAdminSurveyFn

### Community 42 - "login.tsx"
Cohesion: 0.40
Nodes (5): toast, LoginComponent(), loginSchema, Route, loginFn

### Community 48 - "Laporan Implementasi — Integrasi Auto-Isi Data SIAKAD ke TracerStudy"
Cohesion: 0.40
Nodes (4): Impact on Graph, Laporan Implementasi — Integrasi Auto-Isi Data SIAKAD ke TracerStudy, Logic Changes, Modified Files

### Community 50 - "siakadClient.ts"
Cohesion: 0.39
Nodes (8): baseUrl(), fetchMahasiswaByNim(), getToken(), login(), readCache(), SiakadStudent, TokenCache, writeCache()

### Community 52 - "router.tsx"
Cohesion: 0.33
Nodes (5): getRouter(), Register, @tanstack/react-router, Register, routeTree

### Community 53 - "Visitor Statistics Implementation Summary"
Cohesion: 0.40
Nodes (4): Impact on Graph, Logic Changes, Modified Files, Visitor Statistics Implementation Summary

## Knowledge Gaps
- **101 isolated node(s):** `chartData`, `chartData`, `chartData`, `chartData`, `chartData` (+96 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **28 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `cn` to `chart.tsx`?**
  _High betweenness centrality (0.190) - this node is a cross-community bridge._
- **Why does `ChartContainer()` connect `chart.tsx` to `cn`, `adminSurveyFunctions.ts`?**
  _High betweenness centrality (0.028) - this node is a cross-community bridge._
- **Why does `ChartTooltipContent()` connect `chart.tsx` to `cn`, `adminSurveyFunctions.ts`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **What connects `chartData`, `chartData`, `chartData` to the rest of the system?**
  _101 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `seed.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07407407407407407 - nodes in this community are weakly interconnected._
- **Should `chart.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.14714714714714713 - nodes in this community are weakly interconnected._
- **Should `routeTree.gen.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07765151515151515 - nodes in this community are weakly interconnected._