import { formatMessage, getCurrentTimestamp } from './index';

describe('formatMessage', () => {
	it('prefixes the message', () => {
		expect(formatMessage('hello')).toBe('[Workspace] hello');
	});

	it('handles an empty message', () => {
		expect(formatMessage('')).toBe('[Workspace] ');
	});
});

describe('getCurrentTimestamp', () => {
	it('returns the current epoch milliseconds', () => {
		const before = Date.now();
		const value = getCurrentTimestamp();
		const after = Date.now();

		expect(value).toBeGreaterThanOrEqual(before);
		expect(value).toBeLessThanOrEqual(after);
	});
});
