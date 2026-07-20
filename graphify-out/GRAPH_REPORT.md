# Graph Report - /home/dwiwahyuilahi/Personal/Projects/FKG/tracert-study/source-code  (2026-07-20)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 420 nodes · 803 edges · 52 communities (25 shown, 27 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 13 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `d09edd8c`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- seed.ts
- chart.tsx
- routeTree.gen.ts
- index.tsx
- adminSurveyFunctions.ts
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
- useToast.ts
- 0008_true_boomer.sql
- INSTRUKSI_IMPLEMENTASI_SURVEY.md
- FIX_SSE_AUTO_REFRESH.md
- SSE_LOG_ANALYSIS.md
- surveys.$surveyId.live.ts
- Dialog.tsx
- Input.tsx
- survey.$surveySlug.tsx
- FileRoutesByPath
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
3. `FileRoutesByPath` - 15 edges
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
- `CommandEmpty()` --calls--> `cn()`  [EXTRACTED]
  src/components/ui/MultiSelect.tsx → src/lib/utils.ts
- `Badge()` --calls--> `cn()`  [EXTRACTED]
  src/components/ui/badge.tsx → src/lib/utils.ts
- `Card()` --calls--> `cn()`  [EXTRACTED]
  src/components/ui/card.tsx → src/lib/utils.ts
- `CardHeader()` --calls--> `cn()`  [EXTRACTED]
  src/components/ui/card.tsx → src/lib/utils.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Project Tech Stack** — tanstack_start, rsbuild, bun [EXTRACTED 1.00]

## Communities (52 total, 27 thin omitted)

### Community 0 - "seed.ts"
Cohesion: 0.07
Nodes (45): UserManagementComponent(), assertAdmin(), assertAdmin(), createUserFn, listUsersFn, toggleUserStatusFn, updateUserFn, createSessionToken() (+37 more)

### Community 1 - "chart.tsx"
Cohesion: 0.15
Nodes (22): chartData, chartData, chartData, chartData, chartData, Card(), CardContent(), CardDescription() (+14 more)

### Community 2 - "routeTree.gen.ts"
Cohesion: 0.08
Nodes (23): AdminAnalyticsRoute, AdminIndexRoute, AdminRouteRoute, AdminRouteRouteChildren, AdminRouteRouteWithChildren, AdminSurveysIndexRoute, AdminSurveysNewRoute, AdminSurveysSurveyIdRoute (+15 more)

### Community 3 - "index.tsx"
Cohesion: 0.22
Nodes (6): ALL_SURVEYS, Route, Route, getAdminDashboardStatsFn, getSessionFn, getVisitorStatsFn

### Community 4 - "adminSurveyFunctions.ts"
Cohesion: 0.06
Nodes (47): ConfirmDialog(), ConfirmDialogProps, Select(), SelectOption, SelectProps, useSurveyLive(), chartElementToPngBase64(), chartElementToPngBlob() (+39 more)

### Community 6 - "index.tsx"
Cohesion: 0.19
Nodes (8): getAnchorAndDir(), hexToRgb(), LightRays(), Skeleton(), SkeletonProps, Route, getPublicLandingStatsFn, getPublishedSurveysFn

### Community 7 - "0000_brave_pixie.sql"
Cohesion: 0.54
Nodes (7): `answers`, `question_options`, `questions`, `responses`, `sections`, `surveys`, `users`

### Community 10 - "cn"
Cohesion: 0.06
Nodes (53): buttonVariants, Button(), CardAction(), Command(), CommandDialog(), CommandEmpty(), CommandGroup(), CommandInput() (+45 more)

### Community 29 - "useToast.ts"
Cohesion: 0.18
Nodes (11): ToastContainer(), Listener, listeners, toast, toasts, ToastType, useToast(), AdminLayoutComponent() (+3 more)

### Community 35 - "surveys.$surveyId.live.ts"
Cohesion: 0.31
Nodes (7): Route, notifySurveyAnswered(), Route, broadcast(), broadcastAggregate(), g, LiveRegistry

### Community 38 - "survey.$surveySlug.tsx"
Cohesion: 0.31
Nodes (9): Badge(), badgeVariants, getFormattedPeriod(), isSurveyExpired(), SurveyTakingComponent(), getSurveyDetailsFn, lookupMahasiswaByNimFn, startResponseFn (+1 more)

### Community 40 - "FileRoutesByPath"
Cohesion: 0.22
Nodes (7): Route, Route, Route, Route, Route, FileRoutesById, FileRoutesByPath

### Community 41 - "surveys.new.tsx"
Cohesion: 0.67
Nodes (3): CreateSurveyComponent(), Route, createAdminSurveyFn

### Community 42 - "login.tsx"
Cohesion: 0.50
Nodes (4): LoginComponent(), loginSchema, Route, loginFn

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
- **27 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `cn` to `chart.tsx`, `survey.$surveySlug.tsx`?**
  _High betweenness centrality (0.192) - this node is a cross-community bridge._
- **Why does `ChartContainer()` connect `chart.tsx` to `cn`, `adminSurveyFunctions.ts`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._
- **Why does `ChartTooltipContent()` connect `chart.tsx` to `cn`, `adminSurveyFunctions.ts`?**
  _High betweenness centrality (0.028) - this node is a cross-community bridge._
- **What connects `chartData`, `chartData`, `chartData` to the rest of the system?**
  _101 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `seed.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06836158192090395 - nodes in this community are weakly interconnected._
- **Should `routeTree.gen.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08333333333333333 - nodes in this community are weakly interconnected._
- **Should `adminSurveyFunctions.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06327683615819209 - nodes in this community are weakly interconnected._