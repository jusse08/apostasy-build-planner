import { defineEnvVars } from '@sveltejs/kit/env';

export const variables = defineEnvVars({
	PUBLIC_GOATCOUNTER: {
		public: true,
		description: 'GoatCounter count endpoint, e.g. https://stats.example.com/count. Unset: visits are not counted.',
		schema: (value) => {
			if (!value) return undefined;
			if (!URL.canParse(value)) throw new Error('PUBLIC_GOATCOUNTER must be a URL');
			return value;
		}
	}
});
