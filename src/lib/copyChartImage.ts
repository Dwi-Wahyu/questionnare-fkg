async function chartElementToPngBlob(containerEl: HTMLElement): Promise<Blob> {
	const svgs = Array.from(containerEl.querySelectorAll("svg"));
	let mainSvg = svgs[0];
	let maxArea = 0;
	for (const s of svgs) {
		const { width, height } = s.getBoundingClientRect();
		const area = width * height;
		if (area > maxArea) {
			maxArea = area;
			mainSvg = s;
		}
	}
	const svg = mainSvg;
	if (!svg) throw new Error("Grafik tidak ditemukan.");

	let { width, height } = svg.getBoundingClientRect();
	// Fallback to SVG attributes or default dimensions if client bounds are 0
	if (width <= 0)
		width = svg.hasAttribute("width") ? Number(svg.getAttribute("width")) : 800;
	if (height <= 0)
		height = svg.hasAttribute("height")
			? Number(svg.getAttribute("height"))
			: 300;
	if (width <= 0) width = 800;
	if (height <= 0) height = 300;

	const scale = 2; // export at 2x for crisper paste

	// Clone so we don't mutate the live chart, inline computed styles Recharts
	// relies on CSS classes/vars for (fills use var(--chart-N) etc via className,
	// so make sure those CSS custom properties are inherited — cloning inside the
	// same document preserves inherited custom properties from ChartStyle).
	const clone = svg.cloneNode(true) as SVGSVGElement;
	clone.setAttribute("width", String(width));
	clone.setAttribute("height", String(height));
	clone.style.width = `${width}px`;
	clone.style.height = `${height}px`;

	// Inline computed styles from the live SVG to the clone so it has complete color/font information
	const originalElements = svg.querySelectorAll("*");
	const clonedElements = clone.querySelectorAll("*");
	for (let i = 0; i < originalElements.length; i++) {
		const orig = originalElements[i] as HTMLElement;
		const cloned = clonedElements[i] as HTMLElement;
		if (orig && cloned) {
			const tagName = orig.tagName.toLowerCase();
			if (tagName === "g") {
				continue; // Skip group containers
			}

			const style = window.getComputedStyle(orig);

			// Copy display & visibility to preserve hidden elements (e.g. tooltip cursors)
			if (style.display === "none") {
				cloned.style.display = "none";
				continue; // Skip hidden elements styling
			}
			if (style.visibility === "hidden") {
				cloned.style.visibility = "hidden";
			}

			// Copy fill (respecting explicit 'none' and transparent/rgba values)
			if (
				orig.getAttribute("fill") === "none" ||
				style.fill === "none" ||
				style.fill === "rgba(0, 0, 0, 0)" ||
				style.fill === "transparent"
			) {
				cloned.style.fill = "none";
			} else if (style.fill) {
				cloned.style.fill = style.fill;
			}

			// Copy stroke (respecting explicit 'none' and transparent/rgba values)
			if (
				orig.getAttribute("stroke") === "none" ||
				style.stroke === "none" ||
				style.stroke === "rgba(0, 0, 0, 0)" ||
				style.stroke === "transparent"
			) {
				cloned.style.stroke = "none";
			} else if (style.stroke) {
				cloned.style.stroke = style.stroke;
			}

			// Copy stroke configurations from styles
			if (style.strokeWidth) {
				cloned.style.strokeWidth = style.strokeWidth;
			}
			if (style.strokeDasharray) {
				cloned.style.strokeDasharray = style.strokeDasharray;
			}

			if (style.opacity) {
				cloned.style.opacity = style.opacity;
			}

			// Font styling for legends and labels
			if (tagName === "text") {
				cloned.style.fontFamily = style.fontFamily || "Outfit, sans-serif";
				cloned.style.fontSize = style.fontSize;
				cloned.style.fontWeight = style.fontWeight;
			}
		}
	}

	// Extract and draw HTML legend items inside the cloned SVG so they are included in exports
	let renderHeight = height;
	const legendData: { label: string; color: string }[] = [];

	// 1. Try custom data attributes (shadcn custom legend)
	const shadcnItems = containerEl.querySelectorAll("[data-legend-item]");
	if (shadcnItems.length > 0) {
		for (const el of Array.from(shadcnItems)) {
			const label = el.getAttribute("data-legend-label") || "";
			const color = el.getAttribute("data-legend-color") || "#000000";
			if (label) {
				legendData.push({ label, color });
			}
		}
	}

	// 2. If no custom items, try default Recharts legend items (e.g. in grid charts)
	if (legendData.length === 0) {
		const rechartsItems = containerEl.querySelectorAll(".recharts-legend-item");
		for (const el of Array.from(rechartsItems)) {
			const label = el.textContent?.trim() || "";
			if (!label) continue;

			// Find marker color
			let color = "#000000";
			const marker =
				el.querySelector("path, rect, circle, [style*='background-color']") ||
				el.querySelector("svg");
			if (marker) {
				const style = window.getComputedStyle(marker);
				if (
					style.fill &&
					style.fill !== "none" &&
					style.fill !== "rgba(0, 0, 0, 0)" &&
					style.fill !== "transparent"
				) {
					color = style.fill;
				} else if (
					style.backgroundColor &&
					style.backgroundColor !== "rgba(0, 0, 0, 0)" &&
					style.backgroundColor !== "transparent"
				) {
					color = style.backgroundColor;
				} else {
					color =
						marker.getAttribute("fill") ||
						marker.getAttribute("stroke") ||
						"#000000";
				}
			}
			legendData.push({ label, color });
		}
	}

	if (legendData.length > 0) {
		const legendHeight = 35; // vertical height for legend
		renderHeight = height + legendHeight;

		// Update clone size
		clone.setAttribute("height", String(renderHeight));
		clone.style.height = `${renderHeight}px`;
		clone.style.maxHeight = `${renderHeight}px`;

		const viewBox = clone.getAttribute("viewBox");
		if (viewBox) {
			const parts = viewBox.split(/\s+/);
			if (parts.length === 4) {
				parts[3] = String(renderHeight);
				clone.setAttribute("viewBox", parts.join(" "));
			}
		}

		// Create a group container for the legend items
		const legendGroup = document.createElementNS(
			"http://www.w3.org/2000/svg",
			"g",
		);
		legendGroup.setAttribute("class", "custom-svg-legend");
		legendGroup.setAttribute("transform", `translate(0, ${height + 15})`);

		// Estimate width of each item for horizontal centering
		const itemsWithWidth = legendData.map((item) => {
			const textWidth = item.label.length * 6.5; // avg width of Outfit 11px font character
			const itemWidth = 8 + 6 + textWidth + 16; // color rect width (8) + gap (6) + textWidth + horizontal spacer (16)
			return { ...item, width: itemWidth };
		});

		const totalLegendWidth = itemsWithWidth.reduce(
			(sum, item) => sum + item.width,
			0,
		);
		let currentX = Math.max(10, (width - totalLegendWidth) / 2);

		for (const item of itemsWithWidth) {
			const itemG = document.createElementNS("http://www.w3.org/2000/svg", "g");
			itemG.setAttribute("transform", `translate(${currentX}, 0)`);

			// Draw color marker
			const rect = document.createElementNS(
				"http://www.w3.org/2000/svg",
				"rect",
			);
			rect.setAttribute("x", "0");
			rect.setAttribute("y", "-4"); // align vertically with text baseline
			rect.setAttribute("width", "8");
			rect.setAttribute("height", "8");
			rect.setAttribute("rx", "1.5");
			rect.setAttribute("fill", item.color);
			itemG.appendChild(rect);

			// Draw text label
			const text = document.createElementNS(
				"http://www.w3.org/2000/svg",
				"text",
			);
			text.setAttribute("x", "14"); // gap after box
			text.setAttribute("y", "4");
			text.setAttribute("fill", "#434652");
			text.setAttribute("font-family", "Outfit, sans-serif");
			text.setAttribute("font-size", "11px");
			text.setAttribute("font-weight", "500");
			text.textContent = item.label;
			itemG.appendChild(text);

			legendGroup.appendChild(itemG);
			currentX += item.width;
		}

		clone.appendChild(legendGroup);
	}

	const serialized = new XMLSerializer().serializeToString(clone);
	const svgBlob = new Blob([serialized], {
		type: "image/svg+xml;charset=utf-8",
	});
	const svgUrl = URL.createObjectURL(svgBlob);

	try {
		const img = await new Promise<HTMLImageElement>((resolve, reject) => {
			const image = new Image();
			image.onload = () => resolve(image);
			image.onerror = reject;
			image.src = svgUrl;
		});

		const canvas = document.createElement("canvas");
		canvas.width = width * scale;
		canvas.height = renderHeight * scale;
		const ctx = canvas.getContext("2d");
		if (!ctx) throw new Error("Canvas tidak didukung.");

		// White background — charts have a transparent SVG background, and most
		// paste targets (Word, email, Slack) render transparent PNGs on a dark
		// or checkered background, which looks broken. Force white.
		ctx.fillStyle = "#ffffff";
		ctx.fillRect(0, 0, canvas.width, canvas.height);
		ctx.scale(scale, scale);
		ctx.drawImage(img, 0, 0, width, renderHeight);

		const blob: Blob = await new Promise((resolve, reject) =>
			canvas.toBlob(
				(b) => (b ? resolve(b) : reject(new Error("Gagal membuat gambar."))),
				"image/png",
			),
		);
		return blob;
	} finally {
		URL.revokeObjectURL(svgUrl);
	}
}

export async function copyElementChartAsPng(
	containerEl: HTMLElement,
): Promise<void> {
	const blob = await chartElementToPngBlob(containerEl);

	if (
		!navigator.clipboard ||
		!("write" in navigator.clipboard) ||
		typeof ClipboardItem === "undefined"
	) {
		// Fallback: trigger a PNG download instead of clipboard write
		const dlUrl = URL.createObjectURL(blob);
		const link = document.createElement("a");
		link.href = dlUrl;
		link.download = "chart.png";
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		URL.revokeObjectURL(dlUrl);
		throw new Error("FALLBACK_DOWNLOAD"); // let caller show a different toast
	}

	await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
}

export async function chartElementToPngBase64(
	containerEl: HTMLElement,
): Promise<{ base64: string; width: number; height: number }> {
	const blob = await chartElementToPngBlob(containerEl);
	const buf = await blob.arrayBuffer();

	// Convert array buffer to base64
	let binary = "";
	const bytes = new Uint8Array(buf);
	const len = bytes.byteLength;
	for (let i = 0; i < len; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	const base64 = btoa(binary);

	// Get dimensions from the cloned/rendered SVG
	const svgs = Array.from(containerEl.querySelectorAll("svg"));
	let mainSvg = svgs[0];
	let maxArea = 0;
	for (const s of svgs) {
		const { width, height } = s.getBoundingClientRect();
		const area = width * height;
		if (area > maxArea) {
			maxArea = area;
			mainSvg = s;
		}
	}
	const svg = mainSvg;
	let width = 800;
	let height = 300;
	if (svg) {
		const rect = svg.getBoundingClientRect();
		width = rect.width;
		height = rect.height;
	}

	// Add legend height if legend is detected
	const shadcnItems = containerEl.querySelectorAll("[data-legend-item]");
	const rechartsItems = containerEl.querySelectorAll(".recharts-legend-item");
	if (shadcnItems.length > 0 || rechartsItems.length > 0) {
		height += 35;
	}

	return { base64, width, height };
}
