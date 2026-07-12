# Instruction 08 — Chart Display Fixes (horizontal bar height + pie chart for few-option questions)

**Audience:** CLI coding agent (Claude Code) working directly in this repo.
**Primary file in scope:** `src/routes/admin/surveys.$surveyId.tsx` (chart helpers/component section, ~line 2006–2345)
**Supporting file:** `src/components/ui/chart.tsx` (`ChartContainer`, ~line 40–75) — read-only reference for the root cause, one small override needed
**Stack reminders:** Recharts (via shadcn `chart.tsx` wrapper), Tailwind (uses `tailwind-merge` via `cn()` in `src/lib/utils.ts` — later classes in a `cn(...)` call win over earlier ones for the same utility group, e.g. `aspect-square` passed in `className` correctly overrides the base `aspect-video`).

Two independent fixes, both inside `ChartCard` / `pickChartKind`:
- **§A — Root cause + fix for overlapping Y-axis labels** in the `bar-horizontal` chart kind (many-option questions like "Program Studi").
- **§B — New `pie` chart kind** for questions with fewer than 5 options, replacing their current `bar-vertical` rendering.

---

## §A. Bar-horizontal label overlap

### A.1 Root cause (confirmed, no further audit needed)

`ChartContainer` in `src/components/ui/chart.tsx` (~line 66) applies `aspect-video` (locks the chart to a 16:9 box) **unconditionally, to every chart kind**, via its base `className`. The `bar-horizontal` block in `ChartCard` (~line 2258–2296) only adds `min-h-[400px] w-full` on top of that — a **fixed height that does not scale with the number of categories**. With ~30 options like "Program Studi" in the screenshot, each category gets squeezed into a few pixels of vertical space inside that fixed box, so the Y-axis category labels (each rendered as its own text tick) overlap the ticks above/below them. This is a CSS/layout issue, not a Recharts limitation — fixable entirely in the `bar-horizontal` block without touching `ChartContainer`'s shared base styling (which other chart kinds still rely on).

### A.2 Fix — dynamic height driven by category count

Replace the `bar-horizontal` block (~line 2258–2296) with a version that:
1. Computes pixel height from `stat.data.length` instead of a fixed `min-h-[400px]`.
2. Overrides `aspect-video` with `aspect-auto` in the `className` (tailwind-merge resolves the conflict since `aspect-auto` is passed later in the same `cn`-processed className string).
3. Caps the height so a question with an extreme number of options (50+) doesn't produce an absurdly tall card — wrap in a scrollable container past that cap instead.
4. Widens the Y-axis and truncates very long option labels with an ellipsis, consistent with the truncation already used for the `grid` chart kind's X-axis (~line 2319–2321), with the full label still available via the existing `ChartTooltip`.

```tsx
{chartKind === "bar-horizontal" && (() => {
	const rowHeight = 32; // px per category — enough for an 11px label without collision
	const computedHeight = Math.max(400, stat.data.length * rowHeight);
	const cappedHeight = Math.min(computedHeight, 1200); // hard ceiling so the card can't run away
	const needsScroll = computedHeight > cappedHeight;
	const yAxisWidth = 140; // widened from 90 — long prodi/institution names need more room

	const chart = (
		<ChartContainer
			config={chartConfig}
			className="aspect-auto w-full"
			style={{ height: cappedHeight }}
		>
			<BarChart
				data={stat.data}
				layout="vertical"
				margin={{ top: 20, right: 30, bottom: 20, left: 20 }}
			>
				<CartesianGrid horizontal={false} strokeDasharray="3 3" />
				<XAxis type="number" tickLine={false} axisLine={false} />
				<YAxis
					dataKey="label"
					type="category"
					tickLine={false}
					axisLine={false}
					width={yAxisWidth}
					fontSize={10}
					interval={0}
					tickFormatter={(val: string) =>
						val.length > 22 ? `${val.slice(0, 22)}…` : val
					}
				/>
				<ChartTooltip content={<ChartTooltipContent />} />
				<Bar dataKey="count" fill={primaryColor} radius={[0, 4, 4, 0]}>
					<LabelList
						dataKey="count"
						position="right"
						style={{ fill: "#1a1b21", fontSize: 11, fontWeight: "bold" }}
					/>
				</Bar>
			</BarChart>
		</ChartContainer>
	);

	return needsScroll ? (
		<div className="max-h-[600px] overflow-y-auto">{chart}</div>
	) : (
		chart
	);
})()}
```

Notes on the specific numbers:
- `rowHeight = 32`: tuned for `fontSize={10}` category labels plus the bar itself — adjust only if you visually confirm overlap still occurs at this value, don't guess a bigger number preemptively.
- `interval={0}` forces Recharts to render every tick rather than auto-skipping some when it thinks there's insufficient space — with the dynamic height fix this should no longer be needed for spacing, but keep it so no category silently disappears from the axis.
- The 22-character truncation matches the existing convention from the `grid` chart kind (~line 2319–2321) — reuse that exact number for visual consistency across chart kinds, don't invent a different threshold.
- `max-h-[600px] overflow-y-auto` only kicks in when a single question has more categories than fit in a 1200px-tall chart (i.e. more than ~37 options) — this is an edge case guard, not the common path for something like "Program Studi" at ~30 options (which will render at ~960px, under the cap, no scroll).

### A.3 Interaction with chart-copy-to-clipboard (`06`)

`copyElementChartAsPng` (from `06` §B) clones `chartRef.current`'s DOM and rasterizes it — it reads the element's actual rendered size, so a taller dynamically-sized chart is captured correctly with no extra changes needed there. If the chart is inside the new scrollable wrapper (`overflow-y-auto` case), verify the clipboard copy still captures the **full** chart (all categories), not just the visible scrolled viewport — `copyElementChartAsPng` should be cloning the element's full scrollHeight, not just its clientHeight/visible area. If it currently uses `getBoundingClientRect()` or clones only visible bounds, that's a pre-existing edge case worth a quick check, but do not do a large refactor of that utility for this — just confirm the clone step doesn't clip to the scroll container's visible height, and flag it back if it does rather than attempting a fix inline here.

---

## §B. Pie chart for questions with fewer than 5 options

### B.1 Update `pickChartKind` (~line 2033–2050)

Change the `count <= 4` bucket from `"bar-vertical"` to `"pie"` — everything else unchanged:

```tsx
const pickChartKind = (stat: any) => {
	const type = stat.type;
	const count = stat.optionCount || 0;

	if (type === "short_text" || type === "paragraph" || type === "date") {
		return "text";
	}
	if (type === "grid") {
		return "grid";
	}
	if (count <= 4) {
		return "pie";
	}
	if (count <= 8) {
		return "line";
	}
	return "bar-horizontal";
};
```

This means `bar-vertical` is no longer reachable from `pickChartKind`. Leave the `bar-vertical` JSX block (~line 2192–2222) in place rather than deleting it — it's harmless dead code for now and removing it is out of scope for this fix; a future cleanup pass can drop it once confirmed nothing else references that kind.

### B.2 New `pie` chart block

Add this as a new branch alongside the existing `chartKind === "..."` blocks (e.g. right before the `bar-vertical` block, ~line 2192), following the project's existing `chartConfig` (already built at ~line 2096–2122, keyed by `safeKey(item.label)`, which pie's `nameKey` can reuse directly):

```tsx
{chartKind === "pie" && (() => {
	const pieData = stat.data.map((item: any, idx: number) => ({
		...item,
		fill: primaryPalette[idx % primaryPalette.length],
	}));

	return (
		<div className="flex flex-col items-center">
			<ChartContainer
				config={chartConfig}
				className="aspect-square max-h-[280px] w-full"
			>
				<PieChart>
					<ChartTooltip content={<ChartTooltipContent nameKey="label" hideLabel />} />
					<Pie
						data={pieData}
						dataKey="count"
						nameKey="label"
						labelLine={false}
						label={({ payload, ...props }: any) => (
							<text
								cx={props.cx}
								cy={props.cy}
								x={props.x}
								y={props.y}
								textAnchor={props.textAnchor}
								dominantBaseline={props.dominantBaseline}
								fill="#1a1b21"
								fontSize={11}
								fontWeight="bold"
							>
								{payload.count}
							</text>
						)}
					/>
					<ChartLegend
						content={<ChartLegendContent nameKey="label" />}
						className="flex-wrap gap-2 *:basis-1/2 *:justify-start"
					/>
				</PieChart>
			</ChartContainer>
		</div>
	);
})()}
```

Notes:
- `pieData` maps `primaryPalette` onto each slice by index — the existing `chartConfig` (built earlier in the component) already assigns `color: primaryColor` (a single flat color) to every label for the old bar charts, which is fine for bars but would make every pie slice the same color. Don't touch the shared `chartConfig` memo for this — it's used by other chart kinds too — just build the per-slice `fill` locally in `pieData` as shown.
- The custom `label` renders the raw `count` on each slice, matching the "custom label" pattern from `docs/chart/examples/pie-with-custom-label.ts`. If a slice is very small (e.g. 1 out of 150 responses), the number may visually crowd the slice — this is expected/acceptable per the reference pattern; the legend below is the primary readable reference, the on-slice number is secondary.
- `ChartLegend`/`ChartLegendContent` are already exported from `src/components/ui/chart.tsx` (~line 271–367) — import them alongside the existing `ChartContainer, ChartTooltip, ChartTooltipContent` import (~line 2022–2026), no new dependency needed.
- Add `Pie, PieChart` to the existing `recharts` import (~line 2009–2021), alongside `Bar, BarChart, ...`.
- `aspect-square max-h-[280px]` intentionally overrides the base `aspect-video` the same way §A's `aspect-auto` does — tailwind-merge handles this correctly since it's a later class in the same string.

### B.3 Chart-copy compatibility

No changes needed in `copyElementChartAsPng` for the pie case — it clones whatever SVG is inside `[data-chart-root]` (set at ~line 2169), which works the same regardless of chart kind. Verify visually after implementing that the legend (which renders as its own `<ul>`/flex block below the SVG, not inside the `<svg>` itself per shadcn's `ChartLegendContent`) is or isn't expected to be included in the copied image — if the current clipboard utility only clones the `<svg>` element specifically (not its siblings), the legend will be **excluded** from the copied PNG. If that turns out to be the case, flag it back rather than silently shipping a copy button that drops the legend — whether the legend should be included is a product decision, not something to guess.

---

## Verification checklist for the agent

1. Open a survey with a question with 20+ options (e.g. "Program Studi" from the screenshot) — confirm Y-axis labels no longer overlap and every category is visible.
2. Open a survey with a question with ≤4 options — confirm it now renders as a pie chart with legend, not a vertical bar.
3. Open a survey with a question with 5–8 options — confirm it's unchanged (still `line` chart kind, not touched by this instruction).
4. Test the copy-to-clipboard button on both the fixed bar-horizontal chart and the new pie chart — paste into another document and visually confirm the image is complete (not clipped, legend behavior confirmed either way per §B.3).
5. Run `bun run check` before considering this done, per project convention.
