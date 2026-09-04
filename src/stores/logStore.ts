import type { LogMessage } from './types/log';

export const useLogStore = defineStore('log', () => {
	const messages = ref<LogMessage[]>([]);

	const add = (type: LogMessage['type'], content: string) => {
		messages.value.push({
			id: crypto.randomUUID(),
			timestamp: Date.now(),
			type,
			content,
		});

		if (messages.value.length > 100) {
			messages.value.shift();
		}
	};

	const clear = () => {
		messages.value = [];
	};

	return {
		messages,
		add,
		clear,
	};
});
