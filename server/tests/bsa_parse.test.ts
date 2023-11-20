import { expect } from '@jest/globals';

import { Parser, parseLine, parseBsa } from '../src/bsa_parse';
import { DiagnosticSeverity } from 'vscode-languageserver';
import { Token, TokenType } from '../src/bsa_lex';

describe('Parser diagnostics', () => {
	test('addDiagnosticForTokenRange', () => {
		const par = new Parser('', 7);
		par.addDiagnosticForTokenRange(
			'error message', DiagnosticSeverity.Error,
			{ type: TokenType.Keyword, lineNumber: 7, start: 3, end: 5 },
			{ type: TokenType.Keyword, lineNumber: 7, start: 8, end: 11 });
		expect(par.diagnostics.length).toBe(1);
		expect(par.diagnostics[0].severity).toBe(DiagnosticSeverity.Error);
		expect(par.diagnostics[0].range.start.line).toBe(7);
		expect(par.diagnostics[0].range.start.character).toBe(3);
		expect(par.diagnostics[0].range.end.line).toBe(7);
		expect(par.diagnostics[0].range.end.character).toBe(11);
		expect(par.diagnostics[0].message).toEqual('error message');
	});

	test('addDiagnosticForToken', () => {
		const par = new Parser('', 7);
		par.addDiagnosticForToken(
			'error message', DiagnosticSeverity.Error,
			{ type: TokenType.Keyword, lineNumber: 7, start: 3, end: 5 });
		expect(par.diagnostics.length).toBe(1);
		expect(par.diagnostics[0].severity).toBe(DiagnosticSeverity.Error);
		expect(par.diagnostics[0].range.start.line).toBe(7);
		expect(par.diagnostics[0].range.start.character).toBe(3);
		expect(par.diagnostics[0].range.end.line).toBe(7);
		expect(par.diagnostics[0].range.end.character).toBe(5);
		expect(par.diagnostics[0].message).toEqual('error message');
	});
});

describe('Parser addUse', () => {
	test('new entry', () => {
		const par = new Parser('', 7);
		const tokMap = new Map();
		const tok: Token = { type: TokenType.Keyword, lineNumber: 7, start: 3, end: 5, normText: 'test' };
		expect(tokMap.get('test')).toBeUndefined();
		par.addUse(tokMap, tok);
		expect(tokMap.get('test')?.length).toBe(1);
		expect(tokMap.get('test')?.[0].normText).toEqual('test');
		expect(tokMap.get('test')?.[0].type).toEqual(TokenType.Keyword);
	});

	test('existing entry', () => {
		const par = new Parser('', 7);
		const tokMap = new Map();
		const tok1: Token = { type: TokenType.Keyword, lineNumber: 7, start: 3, end: 5, normText: 'test' };
		const tok2: Token = { type: TokenType.Keyword, lineNumber: 7, start: 8, end: 11, normText: 'test' };
		tokMap.set('test', [tok1]);
		par.addUse(tokMap, tok2);
		expect(tokMap.get('test')?.length).toBe(2);
		expect(tokMap.get('test')?.[1].normText).toEqual('test');
		expect(tokMap.get('test')?.[1].type).toBe(TokenType.Keyword);
		expect(tokMap.get('test')?.[0].end).toBe(5);
		expect(tokMap.get('test')?.[1].end).toBe(11);
	});
});

describe('isDone', () => {
	test('false at start when there is a token', () => {
		const par = new Parser('name', 7);
		expect(par.startParse().isDone()).toBe(false);
	});

	test('true at start when statement parses to no tokens', () => {
		const par = new Parser('   ; just a line comment', 7);
		expect(par.startParse().isDone()).toBe(true);
	});

	test('true after pos is advanced to end', () => {
		const par = new Parser('name', 7);
		par.startParse();
		par.pos = par.lex.tokens.length;
		expect(par.isDone()).toBe(true);
	});
});

describe('expectToken', () => {
	test('undefined when parser is done', () => {
		const par = new Parser('name', 7);
		par.startParse();
		par.pos = par.lex.tokens.length;
		expect(par.expectToken(TokenType.Name)).toBeUndefined();
	});

	test('undefined when token not found, pos not moved', () => {
		const par = new Parser('name', 7);
		expect(par.pos).toBe(0);
		expect(par.startParse().expectToken(TokenType.Keyword)).toBeUndefined();
		expect(par.pos).toBe(0);
	});

	test('returns token and advances pos', () => {
		const par = new Parser('name', 7);
		expect(par.pos).toBe(0);
		const tok = par.startParse().expectToken(TokenType.Name);
		expect(tok?.start).toBe(0);
		expect(tok?.end).toBe(4);
		expect(tok?.type).toBe(TokenType.Name);
		expect(tok?.lineNumber).toBe(7);
		expect(tok?.normText).toBe('name');
		expect(par.pos).toBe(1);
	});

	test('with text fails when text does not match', () => {
		const par = new Parser('name', 7);
		expect(par.pos).toBe(0);
		const tok = par.startParse().expectTokenWithText(TokenType.Name, 'other');
		expect(tok).toBeUndefined();
		expect(par.pos).toBe(0);
	});

	test('with text succeeds when text matches', () => {
		const par = new Parser('name', 7);
		expect(par.pos).toBe(0);
		const tok = par.startParse().expectTokenWithText(TokenType.Name, 'name');
		expect(tok?.type).toBe(TokenType.Name);
		expect(tok?.normText).toBe('name');
		expect(par.pos).toBe(1);
	});
});

describe('parseSoloTokens', () => {
	test('does nothing when done', () => {
		const par = new Parser('  ; line comment', 7);
		par.startParse().parseSoloTokens();
		expect(par.isDone()).toBe(true);
		expect(par.diagnostics.length).toBe(0);
	});

	test('does nothing if solo tokens are not present', () => {
		const par = new Parser('sym: lda #$ff', 7);
		par.startParse().parseSoloTokens();
		expect(par.isDone()).toBe(false);
		expect(par.diagnostics.length).toBe(0);
		expect(par.pos).toBe(0);
	});

	test('consumes solo token without error if only token on the line', () => {
		let par = new Parser('  #else    ; line comment', 7);
		par.startParse().parseSoloTokens();
		expect(par.isDone()).toBe(true);
		expect(par.diagnostics.length).toBe(0);

		par = new Parser('#endif', 7);
		par.startParse().parseSoloTokens();
		expect(par.isDone()).toBe(true);
		expect(par.diagnostics.length).toBe(0);

		par = new Parser('  endmac', 7);
		par.startParse().parseSoloTokens();
		expect(par.isDone()).toBe(true);
		expect(par.diagnostics.length).toBe(0);
	});

	test('errors if token after keyword', () => {
		const par = new Parser('  endmac name', 7);
		par.startParse().parseSoloTokens();
		expect(par.isDone()).toBe(true);
		expect(par.diagnostics.length).toBe(1);
		expect(par.diagnostics[0].message.includes('after')).toBe(true);
	});

	test('errors if token before keyword', () => {
		const par = new Parser('sym: endmac', 7);
		par.startParse().parseSoloTokens();
		expect(par.isDone()).toBe(true);
		expect(par.diagnostics.length).toBe(1);
		expect(par.diagnostics[0].message.includes('before')).toBe(true);
	});
});

// TODO: describe('parseIfDirective', () => {});
// TODO: describe('parseIfDefDirective', () => {});
// TODO: describe('handleUnrecognizedHashDirective', () => {});
// TODO: describe('parseMacroDefinitionStart', () => {});

describe('parseLine: empty and comments', () => {
	test('empty string returns empty results', () => {
		const par = parseLine('', 0);
		expect(par.diagnostics.length).toBe(0);
	});

	test('star comment only returns empty results', () => {
		const par = parseLine('  * star comment', 0);
		expect(par.diagnostics.length).toBe(0);
	});

	test('semicolon comment only returns empty results', () => {
		const par = parseLine('   ; line comment', 0);
		expect(par.diagnostics.length).toBe(0);
	});
});

describe('parseBsa', () => {
	test('empty string returns empty results', () => {
		const results = parseBsa('');
		expect(results.diagnostics.length).toBe(0);
	});
});
