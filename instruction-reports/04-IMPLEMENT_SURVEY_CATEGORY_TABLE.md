# Report: Tabel Kategori Survey (Seeder + Wiring UI + Slug Mapping)

- **Modified Files:**
  - `src/server/db/schema.ts`
  - `src/server/db/seedCategories.ts` (created)
  - `src/server/db/seed.ts`
  - `src/server/adminSurveyFunctions.ts`
  - `src/routes/admin/surveys.new.tsx`
  - `src/routes/admin/surveys.$surveyId.tsx`
  - `src/routes/index.tsx`
- **Logic Changes:**
  - **Schema:** Defined the `surveyCategories` table containing `id`, `slug`, `name`, `order`, and `createdAt` columns.
  - **Seeder:** Created the idempotent category seeder in `seedCategories.ts` containing the three requested category options: `survey-kepuasan`, `tracer-study`, and `survey-pengguna`. Hooked this up in the main `seed.ts` file to run after table truncate/user seed, and updated the hardcoded seed survey category configs to match the new kebab-case slugs.
  - **Server Functions:** Added `getSurveyCategoriesFn` to fetch categories ordered by `order`. Left it open (unasserted) to allow landing page retrieval.
  - **New Survey Form:** Added route loader to retrieve categories list, setting the initial category state to the first category slug, and dynamically mapping option fields.
  - **Survey Details (Settings tab):** Loaded categories in parallel inside the route loader, and dynamically populated the category dropdown list.
  - **Landing page:** Fetched all categories inside the loader, generated a `categoryNameBySlug` lookup mapping, implemented the previously inactive horizontal Category filter pill-buttons layout, and mapped the card category tags to the human-readable names.
- **Impact on Graph:**
  - New dependency from `src/routes/index.tsx` and `src/routes/admin/surveys.new.tsx` on `src/server/adminSurveyFunctions.ts`'s `getSurveyCategoriesFn`.
  - New dependency from `src/server/db/seed.ts` on `src/server/db/seedCategories.ts`.
