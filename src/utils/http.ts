import axios, { type AxiosError, type AxiosResponse } from 'axios';

const http = axios.create({
	baseURL: '',
	timeout: 5000,
});

http.interceptors.response.use(
	(response: AxiosResponse) => {
		console.log('response', response);
		if (response.data.status !== 1000) {
			ElMessage({
				type: 'error',
				message: response.data.message,
			});
			return Promise.reject(response.data);
		}
		return response.data;
	},
	(error: AxiosError) => {
		return Promise.reject(error);
	},
);

export default http;
