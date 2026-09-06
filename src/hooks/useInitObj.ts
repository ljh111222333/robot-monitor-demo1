import { ref, type Ref, type UnwrapRef } from 'vue';

export interface UseInitObjReturn<T extends object> {
	obj: Ref<UnwrapRef<T>, T | UnwrapRef<T>>;
	reset: (setVal?: Partial<T>) => void;
}

export const useInitObj = <T extends object>(
	initObj: T,
): UseInitObjReturn<T> => {
	const defaultValue = (setVal: Partial<T> = {}): T => ({
		...initObj,
		...setVal,
	});

	const obj = ref<T>(defaultValue()) as Ref<
		UnwrapRef<T>,
		T | UnwrapRef<T>
	>;

	const reset = (setVal: Partial<T> = {}): void => {
		obj.value = defaultValue(setVal);
	};

	return {
		obj,
		reset,
	};
};
