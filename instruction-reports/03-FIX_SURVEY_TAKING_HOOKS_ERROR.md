# Report: Fix "Rendered fewer hooks than expected" saat Submit Response

- **Modified Files:**
  - `src/routes/survey.$surveySlug.tsx`
- **Logic Changes:**
  - Refactored `SurveyTakingComponent` to ensure unconditional React hook execution order.
  - Moved the early returns (for nested thank-you page outlet, error page, and expired survey warnings) below all React hook declarations (`useSurveyLive`, `useState` states, `useRef` reference, and the `useEffect` draft loader hook).
  - Destructured properties from `loaderData.data` with optional chaining and fallback empty arrays (`loaderData.data?.survey`, `loaderData.data?.sections ?? []`, `loaderData.data?.questions ?? []`) to prevent errors when loader data is empty during the transition.
  - Added a defensive `if (!survey) return;` guard inside the `useEffect` draft loader hook, and updated its dependency array to watch `survey?.id` instead of `survey.id`.
- **Impact on Graph:**
  - None. No new files or component dependencies were introduced.
