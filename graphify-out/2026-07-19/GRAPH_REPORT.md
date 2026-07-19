# Graph Report - /home/dwiwahyuilahi/Personal/Projects/FKG/tracert-study/source-code  (2026-07-19)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 301 nodes · 578 edges · 40 communities (23 shown, 17 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 13 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `c2ce3e25`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- seed.ts
- chart.tsx
- routeTree.gen.ts
- useToast.ts
- adminSurveyFunctions.ts
- surveys.index.tsx
- users.tsx
- 0000_brave_pixie.sql
- INSTRUKSI_MIGRASI_LUCIDE_ICONS.md
- Button.tsx
- index.tsx
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
- 0008_true_boomer.sql
- INSTRUKSI_IMPLEMENTASI_SURVEY.md
- analytics.tsx
- surveys.$surveyId.live.ts
- FileRoutesByPath
- survey.$surveySlug.tsx
- router.tsx
- surveys.new.tsx

## God Nodes (most connected - your core abstractions)
1. `cn()` - 15 edges
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
- `SurveyTakingComponent()` --calls--> `useSurveyLive()`  [EXTRACTED]
  src/routes/survey.$surveySlug.tsx → src/hooks/useSurveyLive.ts
- `FileRoutesByPath` --references--> `Route`  [EXTRACTED]
  src/routeTree.gen.ts → src/routes/admin/analytics.tsx
- `FileRoutesByPath` --references--> `Route`  [EXTRACTED]
  src/routeTree.gen.ts → src/routes/admin/index.tsx

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Project Tech Stack** — tanstack_start, rsbuild, bun [EXTRACTED 1.00]

## Communities (40 total, 17 thin omitted)

### Community 0 - "seed.ts"
Cohesion: 0.10
Nodes (28): createSessionToken(), SessionUser, db, poolConnection, answers, questionOptions, questions, reportGenerations (+20 more)

### Community 1 - "chart.tsx"
Cohesion: 0.14
Nodes (26): chartData, chartData, chartData, chartData, chartData, buttonVariants, Button(), Card() (+18 more)

### Community 2 - "routeTree.gen.ts"
Cohesion: 0.08
Nodes (23): AdminAnalyticsRoute, AdminIndexRoute, AdminRouteRoute, AdminRouteRouteChildren, AdminRouteRouteWithChildren, AdminSurveysIndexRoute, AdminSurveysNewRoute, AdminSurveysSurveyIdRoute (+15 more)

### Community 3 - "useToast.ts"
Cohesion: 0.12
Nodes (17): Input(), InputProps, ToastContainer(), Listener, listeners, toast, toasts, ToastType (+9 more)

### Community 4 - "adminSurveyFunctions.ts"
Cohesion: 0.10
Nodes (32): useSurveyLive(), chartElementToPngBase64(), chartElementToPngBlob(), copyElementChartAsPng(), ChartCard(), formatAnswerForPrint(), pickChartKind(), safeKey() (+24 more)

### Community 5 - "surveys.index.tsx"
Cohesion: 0.21
Nodes (8): ConfirmDialog(), ConfirmDialogProps, Select(), SelectOption, SelectProps, Route, SurveysIndexComponent(), deleteAdminSurveyFn

### Community 6 - "users.tsx"
Cohesion: 0.27
Nodes (10): Dialog(), DialogProps, UserManagementComponent(), assertAdmin(), assertAdmin(), createUserFn, listUsersFn, toggleUserStatusFn (+2 more)

### Community 7 - "0000_brave_pixie.sql"
Cohesion: 0.54
Nodes (7): `answers`, `question_options`, `questions`, `responses`, `sections`, `surveys`, `users`

### Community 10 - "index.tsx"
Cohesion: 0.19
Nodes (8): getAnchorAndDir(), hexToRgb(), LightRays(), Skeleton(), SkeletonProps, Route, getPublicLandingStatsFn, getPublishedSurveysFn

### Community 33 - "analytics.tsx"
Cohesion: 0.22
Nodes (6): ALL_SURVEYS, Route, Route, getAdminDashboardStatsFn, getAdminSurveysListFn, getSessionFn

### Community 34 - "surveys.$surveyId.live.ts"
Cohesion: 0.31
Nodes (7): Route, notifySurveyAnswered(), Route, broadcast(), broadcastAggregate(), g, LiveRegistry

### Community 35 - "FileRoutesByPath"
Cohesion: 0.22
Nodes (7): Route, Route, Route, Route, Route, FileRoutesById, FileRoutesByPath

### Community 36 - "survey.$surveySlug.tsx"
Cohesion: 0.48
Nodes (6): getFormattedPeriod(), isSurveyExpired(), SurveyTakingComponent(), getSurveyDetailsFn, startResponseFn, submitResponseFn

### Community 37 - "router.tsx"
Cohesion: 0.33
Nodes (5): getRouter(), Register, @tanstack/react-router, Register, routeTree

### Community 38 - "surveys.new.tsx"
Cohesion: 0.67
Nodes (3): CreateSurveyComponent(), Route, createAdminSurveyFn

## Knowledge Gaps
- **77 isolated node(s):** `chartData`, `chartData`, `chartData`, `chartData`, `chartData` (+72 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **17 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `ChartContainer()` connect `chart.tsx` to `adminSurveyFunctions.ts`?**
  _High betweenness centrality (0.042) - this node is a cross-community bridge._
- **Why does `ChartTooltipContent()` connect `chart.tsx` to `adminSurveyFunctions.ts`?**
  _High betweenness centrality (0.039) - this node is a cross-community bridge._
- **What connects `chartData`, `chartData`, `chartData` to the rest of the system?**
  _77 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `seed.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.09957325746799431 - nodes in this community are weakly interconnected._
- **Should `chart.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.13821138211382114 - nodes in this community are weakly interconnected._
- **Should `routeTree.gen.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08333333333333333 - nodes in this community are weakly interconnected._
- **Should `useToast.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.12 - nodes in this community are weakly interconnected._