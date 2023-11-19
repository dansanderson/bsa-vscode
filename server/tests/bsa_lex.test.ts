import { expect } from '@jest/globals';

import { lexLine, Lexer, TokenType, Token } from '../src/bsa_lex';

describe('lexLine: empty and comments', () => {
	test('empty string returns empty results', () => {
		const results = lexLine('', 0);
		expect(results.diagnostics.length).toBe(0);
		expect(results.tokens.length).toBe(0);
	});

	test('star comment only returns empty results', () => {
		const results = lexLine('  * star comment', 0);
		expect(results.diagnostics.length).toBe(0);
		expect(results.tokens.length).toBe(0);
	});

	test('semicolon comment only returns empty results', () => {
		const results = lexLine('   ; line comment', 0);
		expect(results.diagnostics.length).toBe(0);
		expect(results.tokens.length).toBe(0);
	});
});
