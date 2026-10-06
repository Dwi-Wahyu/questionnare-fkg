# Graph Report - source-code  (2026-10-07)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 497 nodes · 1092 edges · 46 communities (18 shown, 18 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 14 edges (avg confidence: 0.82)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `96fbc696`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- seed.ts
- chart.tsx
- routeTree.gen.ts
- settings.tsx
- adminSurveyFunctions.ts
- instruksi-spa-navigation-skeleton-survey-detail.md
- surveyFunctions.ts
- useToast.ts
- INSTRUKSI_MIGRASI_LUCIDE_ICONS.md
- surveys.new.tsx
- cn
- Bun
- docs/chart/base.md
- FileRoutesByPath
- description
- Laporan Perubahan: Seeding Form Kepuasan Kategori ISO (Dosen, Mahasiswa, Mitra, Tendik)
- route.tsx
- Universitas Hasanuddin Logo
- Universitas Hasanuddin Favicon
- Universitas Hasanuddin Logo Public
- Rsbuild
- getSessionFn
- INSTRUKSI_IMPLEMENTASI_SURVEY.md
- FIX_SSE_AUTO_REFRESH.md
- SSE_LOG_ANALYSIS.md
- surveys.index.tsx
- authFunctions.ts
- FIX_LIVE_PRESENCE_PRODUCTION.md
- 09-individual-response-delete-print-and-csv-filter-fix.md
- 03-FIX_SURVEY_TAKING_HOOKS_ERROR.md
- 04-IMPLEMENT_SURVEY_CATEGORY_TABLE.md
- Laporan Implementasi — Integrasi Auto-Isi Data SIAKAD ke TracerStudy
- Visitor Statistics Implementation Summary
- Nginx: redirect ke KATEGORI, bukan ke slug survey
- instruksi-fix-kuisioner-pengguna.md
- INSTRUKSI_SINGLE_SECTION_RESPONSES_GRID.md

## God Nodes (most connected - your core abstractions)
1. `cn()` - 63 edges
2. `SurveyDetailComponent()` - 18 edges
3. `db` - 17 edges
4. `seedSurveyCategories()` - 15 edges
5. `FileRoutesByPath` - 14 edges
6. `assertAdmin()` - 14 edges
7. `users` - 13 edges
8. `getSessionFn` - 13 edges
9. `questions` - 11 edges
10. `sections` - 11 edges

## Surprising Connections (you probably didn't know these)
- `CardAction()` --calls--> `cn()`  [EXTRACTED]
  src/components/ui/card.tsx → src/lib/utils.ts
- `FileRoutesByPath` --references--> `Route`  [EXTRACTED]
  src/routeTree.gen.ts → src/routes/admin/analytics.tsx
- `FileRoutesByPath` --references--> `Route`  [EXTRACTED]
  src/routeTree.gen.ts → src/routes/admin/index.tsx
- `FileRoutesByPath` --references--> `Route`  [EXTRACTED]
  src/routeTree.gen.ts → src/routes/admin/route.tsx
- `FileRoutesByPath` --references--> `Route`  [EXTRACTED]
  src/routeTree.gen.ts → src/routes/admin/settings.tsx

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Project Tech Stack** — tanstack_start, rsbuild, bun [EXTRACTED 1.00]

## Communities (46 total, 18 thin omitted)

### Community 0 - "seed.ts"
Cohesion: 0.05
Nodes (70): SessionUser, db, poolConnection, answers, questionOptions, questions, reportGenerations, responses (+62 more)

### Community 1 - "chart.tsx"
Cohesion: 0.10
Nodes (33): chartConfig, chartData, description, chartConfig, chartData, description, chartConfig, chartData (+25 more)

### Community 2 - "routeTree.gen.ts"
Cohesion: 0.08
Nodes (27): getRouter(), Register, @tanstack/react-router, AdminAnalyticsRoute, AdminIndexRoute, AdminRouteRoute, AdminRouteRouteChildren, AdminRouteRouteWithChildren (+19 more)

### Community 3 - "settings.tsx"
Cohesion: 0.33
Nodes (10): DialogProps, Dialog(), Route, SettingsComponent(), updateSurveyCategorySettingsFn, assertAdmin(), createUserFn, listUsersFn (+2 more)

### Community 4 - "adminSurveyFunctions.ts"
Cohesion: 0.10
Nodes (43): chartElementToPngBase64(), chartElementToPngBlob(), copyElementChartAsPng(), ChartCard(), formatAnswerForPrint(), pickChartKind(), Route, safeKey() (+35 more)

### Community 6 - "surveyFunctions.ts"
Cohesion: 0.09
Nodes (30): getAnchorAndDir(), hexToRgb(), LightRays(), Skeleton(), SkeletonProps, Route, getFormattedPeriod(), isSurveyExpired() (+22 more)

### Community 7 - "useToast.ts"
Cohesion: 0.20
Nodes (9): ToastContainer(), Listener, listeners, toasts, ToastType, useToast(), Route, FileRoutesById (+1 more)

### Community 9 - "surveys.new.tsx"
Cohesion: 0.50
Nodes (4): toast, CreateSurveyComponent(), Route, createAdminSurveyFn

### Community 10 - "cn"
Cohesion: 0.06
Nodes (55): Badge(), badgeVariants, buttonVariants, Button(), Command(), CommandDialog(), CommandEmpty(), CommandGroup() (+47 more)

### Community 13 - "FileRoutesByPath"
Cohesion: 0.22
Nodes (6): Route, Route, Route, Route, FileRoutesByPath, getActiveSurveyByCategoryFn

### Community 16 - "Laporan Perubahan: Seeding Form Kepuasan Kategori ISO (Dosen, Mahasiswa, Mitra, Tendik)"
Cohesion: 0.40
Nodes (4): Impact on Graph, Laporan Perubahan: Seeding Form Kepuasan Kategori ISO (Dosen, Mahasiswa, Mitra, Tendik), Logic Changes, Modified Files

### Community 17 - "route.tsx"
Cohesion: 0.50
Nodes (4): AdminLayoutComponent(), Route, RootComponent(), logoutFn

### Community 29 - "getSessionFn"
Cohesion: 0.19
Nodes (12): ALL_SURVEYS, Route, Route, getAdminDashboardStatsFn, getAdminSurveysListFn, getUserFromSession(), getSessionFn, visitorLogs (+4 more)

### Community 35 - "surveys.index.tsx"
Cohesion: 0.10
Nodes (26): ButtonProps, Button(), ConfirmDialog(), ConfirmDialogProps, Select(), SelectOption, SelectProps, useSurveyLive() (+18 more)

### Community 37 - "authFunctions.ts"
Cohesion: 0.33
Nodes (6): InputProps, Input(), LoginComponent(), loginSchema, createSessionToken(), loginFn

### Community 48 - "Laporan Implementasi — Integrasi Auto-Isi Data SIAKAD ke TracerStudy"
Cohesion: 0.40
Nodes (4): Impact on Graph, Laporan Implementasi — Integrasi Auto-Isi Data SIAKAD ke TracerStudy, Logic Changes, Modified Files

### Community 53 - "Visitor Statistics Implementation Summary"
Cohesion: 0.40
Nodes (4): Impact on Graph, Logic Changes, Modified Files, Visitor Statistics Implementation Summary

### Community 54 - "Nginx: redirect ke KATEGORI, bukan ke slug survey"
Cohesion: 0.25
Nodes (7): Catatan, `/etc/nginx/sites-enabled/kepuasan-mahasiswa-fkg`, `/etc/nginx/sites-enabled/pengaduan-fkg`, `/etc/nginx/sites-enabled/survey-pengguna-fkg`, `/etc/nginx/sites-enabled/tracerstudy-fkg`, Kenapa ini menyelesaikan masalahnya, Nginx: redirect ke KATEGORI, bukan ke slug survey

## Knowledge Gaps
- **131 isolated node(s):** `SessionUser`, `AlumniBlock`, `SurveyConfig`, `ChartContextProps`, `TooltipNameType` (+126 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 189 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **18 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `cn` to `chart.tsx`?**
  _High betweenness centrality (0.167) - this node is a cross-community bridge._
- **Why does `ChartContainer()` connect `chart.tsx` to `cn`, `adminSurveyFunctions.ts`?**
  _High betweenness centrality (0.035) - this node is a cross-community bridge._
- **Why does `db` connect `seed.ts` to `settings.tsx`, `adminSurveyFunctions.ts`, `authFunctions.ts`, `surveyFunctions.ts`, `getSessionFn`?**
  _High betweenness centrality (0.034) - this node is a cross-community bridge._
- **What connects `SessionUser`, `AlumniBlock`, `SurveyConfig` to the rest of the system?**
  _131 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `seed.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.054431960049937576 - nodes in this community are weakly interconnected._
- **Should `chart.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.09990749306197964 - nodes in this community are weakly interconnected._
- **Should `routeTree.gen.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07635467980295567 - nodes in this community are weakly interconnected._