import type { HTMLAttributes } from "react";

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
	width?: string | number;
	height?: string | number;
	circle?: boolean;
}

export function Skeleton({
	width,
	height,
	circle,
	className = "",
	style,
	...props
}: SkeletonProps) {
	const styles = {
		width: width,
		height: height,
		borderRadius: circle ? "50%" : undefined,
		...style,
	};

	return <div className={`skeleton ${className}`} style={styles} {...props} />;
}
