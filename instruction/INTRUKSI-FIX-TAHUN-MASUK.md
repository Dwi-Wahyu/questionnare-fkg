# Instruction 11 — Fix empty "Tahun Masuk" chart

**Audience:** CLI coding agent (Claude Code) working directly in this repo.
**Primary file in scope:** `src/server/adminSurveyFunctions.ts` (`computeSurveyStats`, ~line 475–665)
**Secondary file (read-only reference, no change needed):** `src/routes/admin/surveys.$surveyId.tsx` (`pickChartKind` ~line 2724, `ChartCard` bar-vertical block ~line 2993–3060)
**Stack reminders:** Recharts (via shadcn `chart.tsx` wrapper). `BarChart`/`Bar`/`XAxis` in the `bar-vertical` chart kind read `dataKey="label"` and `dataKey="count"` off each entry of `stat.data`.

---

## 1. Root cause (confirmed, no further audit needed)

The question titled **"Tahun Masuk"** is a personal-info field of type `short_text` (free-text year, same category as alamat/prodi/usia/pekerjaan — see `seed.ts`), not an option-based question type.

In the frontend, `pickChartKind()` special-cases this question by title match and forces it to render as a bar chart regardless of its actual type:

```ts
if (stat.title?.toLowerCase().includes("tahun masuk")) {
  return "bar-vertical";
}
```

But `computeSurveyStats()` on the server only produces `{label, count}` aggregated data for option-based types (`multiple_choice`, `dropdown`, `linear_scale`, `checkboxes`, `grid`). Every other type — including `short_text` — falls into the generic `else` branch (~line 640–665), which returns **raw text strings**, not aggregated counts:

```ts
// Text answers aggregation: word list / raw answers list
const textAnswers = qAnswers
  .map((a) => a.valueText)
  .filter((v): v is string => typeof v === "string" && v.trim() !== "");

return {
  questionId: q.id,
  title: q.title,
  type: q.type,
  data: textAnswers.slice(0, 50), // return top 50 raw text responses
};
```

So for "Tahun Masuk", `stat.data` ends up as `["2020", "2021", "2020", ...]` — plain strings. The `bar-vertical` chart in `ChartCard` reads `item.label` and `item.count` off each entry (`<XAxis dataKey="label" />`, `<Bar dataKey="count" />`), both of which are `undefined` on a plain string. Result: the chart renders with no bars and no axis labels — it appears empty, even though responses exist.

This is a **server-side aggregation gap**, not a frontend rendering bug — no changes are needed in `surveys.$surveyId.tsx`.

---

## 2. Fix — aggregate "Tahun Masuk" into `{label, count}` before the generic text branch

Inside `computeSurveyStats`, add a dedicated branch for the "tahun masuk" title check, placed **before** the final `else` (generic free-text) branch, so it intercepts this question the same way the frontend already does by title. Reuse the same `optionCounts`-style aggregation pattern already used for `multiple_choice`/`dropdown` (~line 606–638), keyed by the raw `valueText` value instead of an option label, and sort the result ascending by year so the bar chart reads left-to-right chronologically.

```ts
} else if (q.title?.toLowerCase().includes("tahun masuk")) {
	if (hidden) {
		return {
			questionId: q.id,
			title: q.title,
			type: q.type,
			redacted: true,
			data: [],
		};
	}

	// Free-text year aggregation: raw valueText -> count, sorted ascending.
	const yearCounts: Record<string, number> = {};
	const respondentCount = qAnswers.length;

	qAnswers.forEach((ans) => {
		const raw = typeof ans.valueText === "string" ? ans.valueText.trim() : "";
		if (raw !== "") {
			yearCounts[raw] = (yearCounts[raw] || 0) + 1;
		}
	});

	return {
		questionId: q.id,
		title: q.title,
		type: q.type,
		data: Object.entries(yearCounts)
			.map(([label, count]) => ({
				label,
				count,
				percentage:
					respondentCount > 0
						? Math.round((count / respondentCount) * 100)
						: 0,
			}))
			.sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true })),
	};
} else {
	// ...existing generic text branch stays exactly as-is, unchanged...
```

Notes:

- `q.title?.toLowerCase().includes("tahun masuk")` mirrors the exact check already used in `pickChartKind()` on the frontend — keep both in sync; if one is ever changed, the other must be too. Consider extracting this into a small shared predicate (e.g. `isTahunMasukQuestion(title)`) in a shared `lib` file both server and route code can import, to remove the duplication — optional but recommended if this file grows more special cases.
- `localeCompare(..., { numeric: true })` sorts strings like `"2019"`, `"2020"`, `"2021"` numerically instead of lexicographically — safe even if some respondents typed non-numeric or malformed years (those just sort to wherever their string value falls, rather than crashing).
- Do not touch the existing `optionCounts` branch (~line 589–639) or the final generic `else` branch (~line 640–665) — both are used by other question types/titles and are out of scope here.
- No frontend changes needed: `pickChartKind`, `chartConfig`, and the `bar-vertical` render block in `ChartCard` already expect exactly this `{label, count, percentage}` shape (it's the same shape the pie/line/bar-horizontal kinds already consume).

---

## Verification checklist for the agent

1. Open a survey that has a "Tahun Masuk" question with real responses (use `Form_Kepuasan_Mahasiswa__Responses_.csv` seed/import if available) — confirm the chart now renders bars with year labels on the X-axis and counts/percentages on top, instead of an empty chart.
2. Confirm the tooltip (percentage formatter, already implemented in the frontend for `isTahunMasuk`) shows correct percentages against total respondents.
3. Confirm other free-text questions (e.g. "Alamat", "Pekerjaan") are unaffected and still render as a text list (`chartKind === "text"`), not a bar chart.
4. Confirm other option-based charts (multiple_choice/dropdown/pie/bar-horizontal) are unaffected.
5. Test with a survey where "Tahun Masuk" has zero responses — confirm it renders an empty bar chart gracefully (no crash), consistent with how other option-based charts handle zero responses.
6. Test the "copy chart as image" button on the now-fixed "Tahun Masuk" chart.
7. Run `bun run check` before considering this done, per project convention.
