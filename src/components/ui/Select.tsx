import type { SelectHTMLAttributes } from "react";

interface SelectOption {
	value: string | number;
	label: string;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
	label?: string;
	error?: string;
	options: SelectOption[];
}

export function Select({
	label,
	error,
	options,
	className = "",
	id,
	style,
	...props
}: SelectProps) {
	const combinedClass = `form-input ${className}`.trim();

	return (
		<div className="form-group" style={style}>
			{label && (
				<label htmlFor={id} className="form-label">
					{label}
				</label>
			)}
			<select
				id={id}
				className={combinedClass}
				{...props}
				style={{ cursor: "pointer" }}
			>
				{options.map((opt) => (
					<option key={opt.value} value={opt.value}>
						{opt.label}
					</option>
				))}
			</select>
			{error && <span className="form-error">{error}</span>}
		</div>
	);
}
