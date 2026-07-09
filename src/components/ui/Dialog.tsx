import type { ReactNode } from "react";

interface DialogProps {
	isOpen: boolean;
	onClose: () => void;
	title: string;
	children: ReactNode;
}

export function Dialog({ isOpen, onClose, title, children }: DialogProps) {
	if (!isOpen) return null;

	return (
		<div className="dialog-overlay" onClick={onClose}>
			<div className="dialog-content" onClick={(e) => e.stopPropagation()}>
				<div className="dialog-header">
					<h3 className="dialog-title">{title}</h3>
					<button
						type="button"
						className="dialog-close-btn"
						onClick={onClose}
						aria-label="Close dialog"
					>
						&times;
					</button>
				</div>
				<div className="dialog-body">{children}</div>
			</div>
		</div>
	);
}
