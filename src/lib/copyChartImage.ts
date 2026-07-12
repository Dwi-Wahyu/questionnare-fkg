async function chartElementToPngBlob(
	containerEl: HTMLElement,
): Promise<Blob> {
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

	const { width, height } = svg.getBoundingClientRect();
	const scale = 2; // export at 2x for crisper paste

	// Clone so we don't mutate the live chart, inline computed styles Recharts
	// relies on CSS classes/vars for (fills use var(--chart-N) etc via className,
	// so make sure those CSS custom properties are inherited — cloning inside the
	// same document preserves inherited custom properties from ChartStyle).
	const clone = svg.cloneNode(true) as SVGSVGElement;
	clone.setAttribute("width", String(width));
	clone.setAttribute("height", String(height));

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
		canvas.height = height * scale;
		const ctx = canvas.getContext("2d");
		if (!ctx) throw new Error("Canvas tidak didukung.");

		// White background — charts have a transparent SVG background, and most
		// paste targets (Word, email, Slack) render transparent PNGs on a dark
		// or checkered background, which looks broken. Force white.
		ctx.fillStyle = "#ffffff";
		ctx.fillRect(0, 0, canvas.width, canvas.height);
		ctx.scale(scale, scale);
		ctx.drawImage(img, 0, 0, width, height);

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
): Promise<string> {
	const blob = await chartElementToPngBlob(containerEl);
	const buf = await blob.arrayBuffer();
	
	// Convert array buffer to base64
	let binary = "";
	const bytes = new Uint8Array(buf);
	const len = bytes.byteLength;
	for (let i = 0; i < len; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	return btoa(binary);
}

