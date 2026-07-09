import { useEffect, useState } from "react";
import { useToast } from "./useToast";

export function ToastContainer() {
	const { toasts, toast } = useToast();
	const [isMounted, setIsMounted] = useState(false);

	useEffect(() => {
		setIsMounted(true);
	}, []);

	if (!isMounted) return null;

	return (
		<div className="toast-container">
			{toasts.map((t) => (
				<div key={t.id} className={`toast toast-${t.type}`}>
					<span className="toast-message">{t.message}</span>
					<button
						type="button"
						className="toast-close"
						onClick={() => toast.dismiss(t.id)}
						aria-label="Dismiss toast"
					>
						&times;
					</button>
				</div>
			))}
		</div>
	);
}
