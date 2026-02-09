type Toast = {
	id: number;
	message: string;
};

let nextId = 0;

export const toasts = $state<{ items: Toast[] }>({ items: [] });

export function addToast(message: string, duration = 4000) {
	const id = nextId++;
	toasts.items = [...toasts.items, { id, message }];
	setTimeout(() => dismissToast(id), duration);
}

export function dismissToast(id: number) {
	toasts.items = toasts.items.filter((t) => t.id !== id);
}
