import { PUBLIC_RECAPTCHA_SITE_KEY } from '$env/static/public';

declare global {
	interface Window {
		grecaptcha: {
			enterprise: {
				ready: (callback: () => void) => void;
				execute: (siteKey: string, options: { action: string }) => Promise<string>;
			};
		};
	}
}

let scriptLoaded = false;
let scriptLoading: Promise<void> | null = null;

/**
 * Load the reCAPTCHA Enterprise script if not already loaded
 */
export function loadRecaptchaScript(): Promise<void> {
	if (scriptLoaded) {
		return Promise.resolve();
	}

	if (scriptLoading) {
		return scriptLoading;
	}

	scriptLoading = new Promise((resolve, reject) => {
		if (typeof window === 'undefined') {
			reject(new Error('reCAPTCHA can only be loaded in browser'));
			return;
		}

		// Check if script already exists
		const existingScript = document.querySelector(
			`script[src*="recaptcha/enterprise.js"]`
		);
		if (existingScript) {
			scriptLoaded = true;
			resolve();
			return;
		}

		const script = document.createElement('script');
		script.src = `https://www.google.com/recaptcha/enterprise.js?render=${PUBLIC_RECAPTCHA_SITE_KEY}`;
		script.async = true;
		script.defer = true;

		script.onload = () => {
			scriptLoaded = true;
			resolve();
		};

		script.onerror = () => {
			scriptLoading = null;
			reject(new Error('Failed to load reCAPTCHA script'));
		};

		document.head.appendChild(script);
	});

	return scriptLoading;
}

/**
 * Execute reCAPTCHA Enterprise and get a token
 * @param action - The action name for this reCAPTCHA execution (e.g., 'LOGIN', 'REGISTER', 'FORGOT_PASSWORD')
 * @returns Promise resolving to the reCAPTCHA token
 */
export async function executeRecaptcha(action: string): Promise<string> {
	await loadRecaptchaScript();

	return new Promise((resolve, reject) => {
		window.grecaptcha.enterprise.ready(() => {
			window.grecaptcha.enterprise
				.execute(PUBLIC_RECAPTCHA_SITE_KEY, { action })
				.then(resolve)
				.catch(reject);
		});
	});
}
