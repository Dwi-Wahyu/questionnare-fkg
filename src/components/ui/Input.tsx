import type { InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
	label?: string;
	error?: string;
}

export function Input({
	label,
	error,
	className = "",
	id,
	...props
}: InputProps) {
	const combinedClass = `form-input ${className}`.trim();
	return (
		<div className="form-group">
			{label && (
				<label htmlFor={id} className="form-label">
					{label}
				</label>
			)}
			<input id={id} className={combinedClass} {...props} />
			{error && <span className="form-error">{error}</span>}
		</div>
	);
}
