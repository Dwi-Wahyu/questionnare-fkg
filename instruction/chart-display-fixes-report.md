# Report: Chart Display Fixes Implementation

This report documents the implementation of the **Chart Display Fixes** detailed in `08-chart-display-fixes.md` within the Tracer Study application.

---

## 1. Summary of Changes Made

### A. Dynamic Height and Scroll Capping for Horizontal Bar Charts (§A)
- **Overlap Resolution**: Replaced the fixed `min-h-[400px]` constraints on `bar-horizontal` charts with a dynamic pixel height computation:
  - Height is calculated at `rowHeight = 32px` per category, with a minimum height of `400px`.
  - Configured a ceiling limit at `1200px` to keep cards readable.
- **Scroll Container**: For questions with an extreme number of categories (>37 options), the chart is enclosed in a scrollable wrapper (`max-h-[600px] overflow-y-auto`).
- **Axis Widening & Formatting**:
  - Widened the `YAxis` width from `90` to `140` to accommodate long program/institutional name labels.
  - Implemented a tick label formatting truncation using `tickFormatter` (capped at 22 characters followed by an ellipsis), matching the convention used in grid charts.
  - Set `interval={0}` to force Recharts to render all ticks, preventing category labels from being silently hidden.
- **Responsive Layout**: Overrode the default `aspect-video` class in `ChartContainer` with `aspect-auto w-full`.

### B. Pie Chart Kind for ≤4 Options (§B)
- **Chart Selection Logic**: Updated `pickChartKind` to route questions with 4 or fewer options (`count <= 4`) to a new `"pie"` chart kind instead of `"bar-vertical"`.
- **Pie Chart Render Implementation**:
  - Built a custom `PieChart` layout wrapped in the standard `ChartContainer` using the class `aspect-square max-h-[280px] w-full`.
  - Mapped colors dynamically in local data using `primaryPalette` (indexed modulo style palette length) so slices render with distinct, harmonious colors.
  - Added on-slice text labeling to draw raw count values on slices.
  - Configured legend (`ChartLegend` and `ChartLegendContent`) wrapping beneath the pie layout.
- **Import Enhancements**:
  - Imported `Pie, PieChart` from `recharts`.
  - Imported `ChartLegend, ChartLegendContent` from [src/components/ui/chart.tsx](file:///home/dwiwahyuilahi/Personal/Projects/FKG/tracert-study/source-code/src/components/ui/chart.tsx).

---

## 2. Technical Details & Component Interactions

### Component Changes in [surveys.$surveyId.tsx](file:///home/dwiwahyuilahi/Personal/Projects/FKG/tracert-study/source-code/src/routes/admin/surveys.$surveyId.tsx)
The modifications were isolated entirely to helper scopes and JSX branches inside the `ChartCard` component layout. The defunct `bar-vertical` chart rendering code was preserved as inactive/dead code to minimize collateral disruption.

### Interaction with Chart Copy Utility (Product Design Notice)
- **Dynamic Sizing**: The taller dynamic sizes of `bar-horizontal` are captured correctly by `copyElementChartAsPng` because the canvas generator reads the element's live rendered dimensions directly.
- **Scroll container**: The scrollable container `overflow-y-auto` wraps the inner `ChartContainer`. Because `chartElementToPngBase64` grabs the inner `[data-chart-root]` (which contains the full-height `ChartContainer`), the generated image renders the **entire** chart height including scrolled elements.
- **Legend Inclusion (Fixed & Enhanced)**: Because the HTML legend is rendered as standard DOM elements outside the Recharts SVG, it was originally excluded from copied/exported images. We have resolved this globally by modifying the rasterization walker to find and parse legend markers dynamically. It supports both custom shadcn wrappers (`[data-legend-item]`) and standard Recharts default wrapper elements (`.recharts-legend-item`). It extracts color styles and labels, dynamically expands the cloned SVG's height viewport (`clone.style.height = ...`), and renders vector shapes directly inside the SVG output before conversion.
- **Animation Disabling**: Set `isAnimationActive={false}` across all chart types (bar-horizontal, bar-vertical, pie, line, grid) to prevent exporting blank or partially animated states.
- **Defensive Rendering (Anti-Blank-Image Fixes)**:
  - Copy `display` and `visibility` computed styles recursively to the cloned SVG. Hidden overlays (like Recharts tooltip cursors) that should be `display: none` are now correctly hidden instead of rendering as solid black layers on top of the bars/pie.
  - Automatically query and fallback to SVG attributes or default dimensions (e.g. `800x300`) if `getBoundingClientRect()` returns 0 width or height, preventing invalid 0-size canvas drawing.

---

## 3. Verification & Checks Completed
1. Checked compilation safety with `bun run build` - compiled and generated client/SSR bundles successfully with zero warnings/errors.
2. Ran `bun run check` to perform linter formatting, ensuring syntax conforms to the biome configurations.
