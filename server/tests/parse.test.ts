import { expect } from '@jest/globals';

import { parseBsa } from '../src/bsa';

describe('parseBsa', () => {
	test('empty string returns empty results', () => {
		const results = parseBsa('');
		expect(results.diagnostics.length).toBe(0);
	});
});
