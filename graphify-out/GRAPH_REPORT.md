# Graph Report - /home/dwiwahyuilahi/Personal/Projects/FKG/tracert-study/source-code  (2026-08-04)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 470 nodes · 890 edges · 56 communities (23 shown, 33 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 14 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `ab50dc0f`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- seed.ts
- chart.tsx
- routeTree.gen.ts
- settings.tsx
- adminSurveyFunctions.ts
- instruksi-spa-navigation-skeleton-survey-detail.md
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
- 0010_third_tarot.sql
- 09-individual-response-delete-print-and-csv-filter-fix.md
- 0009_flat_zarda.sql
- 03-FIX_SURVEY_TAKING_HOOKS_ERROR.md
- 04-IMPLEMENT_SURVEY_CATEGORY_TABLE.md
- Laporan Implementasi — Integrasi Auto-Isi Data SIAKAD ke TracerStudy
- `questions`
- siakadClient.ts
- Visitor Statistics Implementation Summary
- Nginx: redirect ke KATEGORI, bukan ke slug survey
- instruksi-fix-kuisioner-pengguna.md
- 0011_mature_forgotten_one.sql
- INSTRUKSI_SINGLE_SECTION_RESPONSES_GRID.md

## God Nodes (most connected - your core abstractions)
1. `cn()` - 63 edges
2. `SurveyDetailComponent()` - 18 edges
3. `FileRoutesByPath` - 14 edges
4. `db` - 12 edges
5. `ChartTooltipContent()` - 10 edges
6. `ChartContainer()` - 9 edges
7. `SurveyTakingComponent()` - 9 edges
8. `getUserFromSession()` - 9 edges
9. `users` - 9 edges
10. `Card()` - 8 edges

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

## Communities (56 total, 33 thin omitted)

### Community 0 - "seed.ts"
Cohesion: 0.08
Nodes (42): createSessionToken(), SessionUser, db, poolConnection, answers, questionOptions, questions, responses (+34 more)

### Community 1 - "chart.tsx"
Cohesion: 0.15
Nodes (22): chartData, chartData, chartData, chartData, chartData, Card(), CardContent(), CardDescription() (+14 more)

### Community 2 - "routeTree.gen.ts"
Cohesion: 0.06
Nodes (43): getRouter(), Register, @tanstack/react-router, Route, Route, Route, Route, Route (+35 more)

### Community 3 - "settings.tsx"
Cohesion: 0.30
Nodes (10): SettingsComponent(), assertAdmin(), updateSurveyCategorySettingsFn, assertAdmin(), createUserFn, listUsersFn, toggleUserStatusFn, updateUserFn (+2 more)

### Community 4 - "adminSurveyFunctions.ts"
Cohesion: 0.09
Nodes (38): chartElementToPngBase64(), chartElementToPngBlob(), copyElementChartAsPng(), ChartCard(), formatAnswerForPrint(), pickChartKind(), safeKey(), SurveyDetailComponent() (+30 more)

### Community 6 - "survey.$surveySlug.tsx"
Cohesion: 0.11
Nodes (26): Badge(), badgeVariants, useSurveyLive(), getFormattedPeriod(), isSurveyExpired(), SurveyTakingComponent(), g, getAggregatePresence() (+18 more)

### Community 7 - "0000_brave_pixie.sql"
Cohesion: 0.54
Nodes (7): `answers`, `question_options`, `questions`, `responses`, `sections`, `surveys`, `users`

### Community 10 - "cn"
Cohesion: 0.06
Nodes (53): buttonVariants, Button(), CardAction(), Command(), CommandDialog(), CommandEmpty(), CommandGroup(), CommandInput() (+45 more)

### Community 29 - "useToast.ts"
Cohesion: 0.08
Nodes (24): ToastContainer(), Listener, listeners, toast, toasts, ToastType, useToast(), ALL_SURVEYS (+16 more)

### Community 35 - "index.tsx"
Cohesion: 0.10
Nodes (15): getAnchorAndDir(), hexToRgb(), LightRays(), ConfirmDialog(), ConfirmDialogProps, Select(), SelectOption, SelectProps (+7 more)

### Community 48 - "Laporan Implementasi — Integrasi Auto-Isi Data SIAKAD ke TracerStudy"
Cohesion: 0.40
Nodes (4): Impact on Graph, Laporan Implementasi — Integrasi Auto-Isi Data SIAKAD ke TracerStudy, Logic Changes, Modified Files

### Community 52 - "siakadClient.ts"
Cohesion: 0.39
Nodes (8): baseUrl(), fetchMahasiswaByNim(), getToken(), login(), readCache(), SiakadStudent, TokenCache, writeCache()

### Community 53 - "Visitor Statistics Implementation Summary"
Cohesion: 0.40
Nodes (4): Impact on Graph, Logic Changes, Modified Files, Visitor Statistics Implementation Summary

### Community 54 - "Nginx: redirect ke KATEGORI, bukan ke slug survey"
Cohesion: 0.25
Nodes (7): Catatan, `/etc/nginx/sites-enabled/kepuasan-mahasiswa-fkg`, `/etc/nginx/sites-enabled/pengaduan-fkg`, `/etc/nginx/sites-enabled/survey-pengguna-fkg`, `/etc/nginx/sites-enabled/tracerstudy-fkg`, Kenapa ini menyelesaikan masalahnya, Nginx: redirect ke KATEGORI, bukan ke slug survey

## Knowledge Gaps
- **119 isolated node(s):** `chartData`, `chartData`, `chartData`, `chartData`, `chartData` (+114 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **33 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `cn` to `chart.tsx`, `survey.$surveySlug.tsx`?**
  _High betweenness centrality (0.168) - this node is a cross-community bridge._
- **Why does `ChartContainer()` connect `chart.tsx` to `cn`, `adminSurveyFunctions.ts`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **Why does `ChartTooltipContent()` connect `chart.tsx` to `cn`, `adminSurveyFunctions.ts`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **What connects `chartData`, `chartData`, `chartData` to the rest of the system?**
  _119 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `seed.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07706766917293233 - nodes in this community are weakly interconnected._
- **Should `routeTree.gen.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05697278911564626 - nodes in this community are weakly interconnected._
- **Should `adminSurveyFunctions.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08792270531400966 - nodes in this community are weakly interconnected._