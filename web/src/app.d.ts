// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}

	interface Window {
		/** GoatCounter's count.js, loaded only when PUBLIC_GOATCOUNTER is set. */
		goatcounter?: { count?: (vars: { path: string }) => void };
	}
}

export {};
