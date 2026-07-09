import { useEffect, useState } from "react";

export interface ToastType {
	id: string;
	message: string;
	type: "success" | "error";
}

type Listener = (toasts: ToastType[]) => void;

let toasts: ToastType[] = [];
const listeners = new Set<Listener>();

function emit() {
	for (const listener of listeners) {
		listener([...toasts]);
	}
}

export const toast = {
	success(message: string, duration = 3000) {
		const id = Math.random().toString(36).substring(2, 9);
		toasts = [...toasts, { id, message, type: "success" }];
		emit();
		setTimeout(() => {
			this.dismiss(id);
		}, duration);
	},
	error(message: string, duration = 4000) {
		const id = Math.random().toString(36).substring(2, 9);
		toasts = [...toasts, { id, message, type: "error" }];
		emit();
		setTimeout(() => {
			this.dismiss(id);
		}, duration);
	},
	dismiss(id: string) {
		toasts = toasts.filter((t) => t.id !== id);
		emit();
	},
};

export function useToast() {
	const [state, setState] = useState<ToastType[]>(toasts);

	useEffect(() => {
		const listener = (newToasts: ToastType[]) => setState(newToasts);
		listeners.add(listener);
		return () => {
			listeners.delete(listener);
		};
	}, []);

	return { toasts: state, toast };
}
