# Graph Report - /home/dwiwahyuilahi/Personal/Projects/FKG/tracert-study/source-code  (2026-07-19)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 378 nodes · 734 edges · 48 communities (23 shown, 25 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 13 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `7c321e98`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- seed.ts
- chart.tsx
- routeTree.gen.ts
- analytics.tsx
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
- router.tsx
- login.tsx
- surveys.new.tsx
- 09-individual-response-delete-print-and-csv-filter-fix.md
- 0009_flat_zarda.sql
- 03-FIX_SURVEY_TAKING_HOOKS_ERROR.md
- 04-IMPLEMENT_SURVEY_CATEGORY_TABLE.md

## God Nodes (most connected - your core abstractions)
1. `cn()` - 61 edges
2. `FileRoutesByPath` - 15 edges
3. `SurveyDetailComponent()` - 14 edges
4. `ChartTooltipContent()` - 10 edges
5. `ChartContainer()` - 9 edges
6. `db` - 9 edges
7. `Card()` - 8 edges
8. `CardHeader()` - 8 edges
9. `CardTitle()` - 8 edges
10. `CardDescription()` - 8 edges

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

## Communities (48 total, 25 thin omitted)

### Community 0 - "seed.ts"
Cohesion: 0.08
Nodes (39): UserManagementComponent(), assertAdmin(), assertAdmin(), createUserFn, listUsersFn, toggleUserStatusFn, updateUserFn, createSessionToken() (+31 more)

### Community 1 - "chart.tsx"
Cohesion: 0.15
Nodes (23): chartData, chartData, chartData, chartData, chartData, Card(), CardAction(), CardContent() (+15 more)

### Community 2 - "routeTree.gen.ts"
Cohesion: 0.08
Nodes (23): AdminAnalyticsRoute, AdminIndexRoute, AdminRouteRoute, AdminRouteRouteChildren, AdminRouteRouteWithChildren, AdminSurveysIndexRoute, AdminSurveysNewRoute, AdminSurveysSurveyIdRoute (+15 more)

### Community 3 - "analytics.tsx"
Cohesion: 0.22
Nodes (6): ALL_SURVEYS, Route, Route, getAdminDashboardStatsFn, getAdminSurveysListFn, getSessionFn

### Community 4 - "adminSurveyFunctions.ts"
Cohesion: 0.10
Nodes (32): chartElementToPngBase64(), chartElementToPngBlob(), copyElementChartAsPng(), ChartCard(), formatAnswerForPrint(), pickChartKind(), safeKey(), SurveyDetailComponent() (+24 more)

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

### Community 29 - "useToast.ts"
Cohesion: 0.18
Nodes (11): ToastContainer(), Listener, listeners, toast, toasts, ToastType, useToast(), AdminLayoutComponent() (+3 more)

### Community 35 - "surveys.$surveyId.live.ts"
Cohesion: 0.31
Nodes (7): Route, notifySurveyAnswered(), Route, broadcast(), broadcastAggregate(), g, LiveRegistry

### Community 38 - "survey.$surveySlug.tsx"
Cohesion: 0.39
Nodes (7): useSurveyLive(), getFormattedPeriod(), isSurveyExpired(), SurveyTakingComponent(), getSurveyDetailsFn, startResponseFn, submitResponseFn

### Community 40 - "FileRoutesByPath"
Cohesion: 0.22
Nodes (7): Route, Route, Route, Route, Route, FileRoutesById, FileRoutesByPath

### Community 41 - "router.tsx"
Cohesion: 0.33
Nodes (5): getRouter(), Register, @tanstack/react-router, Register, routeTree

### Community 42 - "login.tsx"
Cohesion: 0.50
Nodes (4): LoginComponent(), loginSchema, Route, loginFn

### Community 43 - "surveys.new.tsx"
Cohesion: 0.67
Nodes (3): CreateSurveyComponent(), Route, createAdminSurveyFn

## Knowledge Gaps
- **87 isolated node(s):** `chartData`, `chartData`, `chartData`, `chartData`, `chartData` (+82 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **25 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `cn` to `chart.tsx`?**
  _High betweenness centrality (0.210) - this node is a cross-community bridge._
- **Why does `ChartContainer()` connect `chart.tsx` to `cn`, `adminSurveyFunctions.ts`?**
  _High betweenness centrality (0.035) - this node is a cross-community bridge._
- **Why does `ChartTooltipContent()` connect `chart.tsx` to `cn`, `adminSurveyFunctions.ts`?**
  _High betweenness centrality (0.034) - this node is a cross-community bridge._
- **What connects `chartData`, `chartData`, `chartData` to the rest of the system?**
  _87 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `seed.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07918552036199095 - nodes in this community are weakly interconnected._
- **Should `chart.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.14714714714714713 - nodes in this community are weakly interconnected._
- **Should `routeTree.gen.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08333333333333333 - nodes in this community are weakly interconnected._