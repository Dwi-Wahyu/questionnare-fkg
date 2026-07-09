import type { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	variant?: "primary" | "secondary" | "danger";
}

export function Button({
	children,
	variant = "primary",
	className = "",
	type = "button",
	...props
}: ButtonProps) {
	const baseClass = `btn btn-${variant}`;
	const combinedClass = `${baseClass} ${className}`.trim();

	return (
		<button type={type} className={combinedClass} {...props}>
			{children}
		</button>
	);
}
