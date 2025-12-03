/**
 * Sentry error tracking utilities
 * Provides consistent error capturing across client and server
 */
import * as Sentry from '@sentry/sveltekit';

export type ErrorContext = {
	action?: string;
	component?: string;
	userId?: string;
	userEmail?: string;
	route?: string;
	extra?: Record<string, unknown>;
};

/**
 * Capture an error with additional context
 */
export function captureError(error: unknown, context?: ErrorContext): string {
	const errorId = crypto.randomUUID();

	// Set user context if provided
	if (context?.userId || context?.userEmail) {
		Sentry.setUser({
			id: context.userId,
			email: context.userEmail
		});
	}

	// Add custom context
	if (context) {
		Sentry.setContext('errorContext', {
			action: context.action,
			component: context.component,
			route: context.route,
			errorId,
			...context.extra
		});
	}

	// Capture the exception
	Sentry.captureException(error, {
		tags: {
			errorId,
			action: context?.action,
			component: context?.component
		}
	});

	return errorId;
}

/**
 * Capture a message (non-error) with context
 */
export function captureMessage(
	message: string,
	level: 'info' | 'warning' | 'error' = 'info',
	context?: ErrorContext
): string {
	const errorId = crypto.randomUUID();

	if (context) {
		Sentry.setContext('messageContext', {
			action: context.action,
			component: context.component,
			route: context.route,
			errorId,
			...context.extra
		});
	}

	Sentry.captureMessage(message, {
		level,
		tags: {
			errorId,
			action: context?.action,
			component: context?.component
		}
	});

	return errorId;
}

/**
 * Set user context for subsequent error captures
 */
export function setUserContext(user: { id?: string; email?: string; username?: string } | null): void {
	if (user) {
		Sentry.setUser(user);
	} else {
		Sentry.setUser(null);
	}
}

/**
 * Add breadcrumb for tracking user actions
 */
export function addBreadcrumb(
	message: string,
	category: string,
	data?: Record<string, unknown>
): void {
	Sentry.addBreadcrumb({
		message,
		category,
		data,
		level: 'info'
	});
}

/**
 * Start a performance transaction
 */
export function startTransaction(name: string, op: string) {
	return Sentry.startSpan({ name, op }, (span) => span);
}

/**
 * Wrapper for async functions to capture errors
 */
export async function withErrorCapture<T>(
	fn: () => Promise<T>,
	context?: ErrorContext
): Promise<T> {
	try {
		return await fn();
	} catch (error) {
		captureError(error, context);
		throw error;
	}
}

/**
 * Create a scoped error capturer for a specific component/action
 */
export function createErrorCapturer(defaultContext: Partial<ErrorContext>) {
	return (error: unknown, additionalContext?: Partial<ErrorContext>): string => {
		return captureError(error, {
			...defaultContext,
			...additionalContext
		} as ErrorContext);
	};
}
