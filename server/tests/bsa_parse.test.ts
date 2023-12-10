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

describe('expectExpression', () => {
	test('false when done', () => {
		const par = new Parser('  ; line comment', 7);
		expect(par.startParse().expectExpression()).toBe(false);
		expect(par.isDone()).toBe(true);
		expect(par.diagnostics.length).toBe(0);
	});

	test('false when comma', () => {
		const par = new Parser(', xyz', 7);
		expect(par.startParse().expectExpression()).toBe(false);
		expect(par.diagnostics.length).toBe(0);
	});

	test('one symbol ok', () => {
		const par = new Parser('abc', 7);
		expect(par.startParse().expectExpression()).toBe(true);
		expect(par.diagnostics.length).toBe(0);
		expect(par.isDone()).toBe(true);
		expect(par.symbolUses.get('abc')?.[0]).toBeDefined();
	});

	test('star symbol ok', () => {
		const par = new Parser('(*)', 7);
		expect(par.startParse().expectExpression()).toBe(true);
		expect(par.diagnostics.length).toBe(0);
		expect(par.isDone()).toBe(true);
	});

	test('ampersand symbol ok', () => {
		const par = new Parser('&', 7);
		expect(par.startParse().expectExpression()).toBe(true);
		expect(par.diagnostics.length).toBe(0);
		expect(par.isDone()).toBe(true);
	});

	test('error empty brakcets', () => {
		const par = new Parser('()', 7);
		expect(par.startParse().expectExpression()).toBe(false);
		expect(par.diagnostics.length).toBe(1);
	});

	test('error missing closing bracket', () => {
		const par = new Parser('(abc', 7);
		expect(par.startParse().expectExpression()).toBe(false);
		expect(par.diagnostics.length).toBe(1);
	});

	test('one symbol in brackets ok', () => {
		const par = new Parser('(abc)', 7);
		expect(par.startParse().expectExpression()).toBe(true);
		expect(par.diagnostics.length).toBe(0);
		expect(par.isDone()).toBe(true);
		expect(par.symbolUses.get('abc')?.[0]).toBeDefined();
	});

	test('one symbol in square brackets ok', () => {
		const par = new Parser('[abc]', 7);
		expect(par.startParse().expectExpression()).toBe(true);
		expect(par.diagnostics.length).toBe(0);
		expect(par.isDone()).toBe(true);
		expect(par.symbolUses.get('abc')?.[0]).toBeDefined();
	});

	test('error wrong closing bracket', () => {
		const par = new Parser('(abc]', 7);
		expect(par.startParse().expectExpression()).toBe(false);
		expect(par.diagnostics.length).toBe(1);
	});

	test('unary operator ok', () => {
		const par = new Parser('<abc', 7);
		expect(par.startParse().expectExpression()).toBe(true);
		expect(par.diagnostics.length).toBe(0);
		expect(par.isDone()).toBe(true);
		expect(par.symbolUses.get('abc')?.[0]).toBeDefined();
	});

	test('unary operator with paren expression ok', () => {
		const par = new Parser('<(abc)', 7);
		expect(par.startParse().expectExpression()).toBe(true);
		expect(par.diagnostics.length).toBe(0);
		expect(par.isDone()).toBe(true);
		expect(par.symbolUses.get('abc')?.[0]).toBeDefined();
	});

	test('starts with non-unary operator error', () => {
		const par = new Parser('==abc', 7);
		expect(par.startParse().expectExpression()).toBe(false);
		expect(par.diagnostics.length).toBe(1);
	});

	test('number plus number ok', () => {
		const par = new Parser('1+2', 7);
		expect(par.startParse().expectExpression()).toBe(true);
		expect(par.diagnostics.length).toBe(0);
		expect(par.isDone()).toBe(true);
	});

	test('number plus number times number ok', () => {
		const par = new Parser('1+2*3', 7);
		expect(par.startParse().expectExpression()).toBe(true);
		expect(par.diagnostics.length).toBe(0);
		expect(par.isDone()).toBe(true);
	});

	test('number times number plus number ok', () => {
		const par = new Parser('1*2+3', 7);
		expect(par.startParse().expectExpression()).toBe(true);
		expect(par.diagnostics.length).toBe(0);
		expect(par.isDone()).toBe(true);
	});

	test('complex expression ok', () => {
		const par = new Parser('<(sym + $c000 >> 2 - %0100) + >sym2', 7);
		expect(par.startParse().expectExpression()).toBe(true);
		expect(par.diagnostics.length).toBe(0);
		expect(par.isDone()).toBe(true);
		expect(par.symbolUses.get('sym')?.[0]).toBeDefined();
		expect(par.symbolUses.get('sym2')?.[0]).toBeDefined();
	});

	test('complex expression missing last term error', () => {
		const par = new Parser('<(sym + $c000 >> 2 - %0100) +', 7);
		expect(par.startParse().expectExpression()).toBe(false);
		expect(par.diagnostics.length).toBe(1);
	});

	test('complex expression missing a middle term error', () => {
		const par = new Parser('<(sym + >> 2 - %0100) + >sym2', 7);
		expect(par.startParse().expectExpression()).toBe(false);
		expect(par.diagnostics.length).toBe(2);
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

describe('parseIfDefDirective', () => {
	test('does nothing if not present', () => {
		const par = new Parser('sym: lda #$ff', 7);
		par.startParse().parseIfDefDirective();
		expect(par.isDone()).toBe(false);
		expect(par.diagnostics.length).toBe(0);
		expect(par.pos).toBe(0);
	});

	test('succeeds on valid statement', () => {
		const par = new Parser('#ifdef sym', 7);
		par.startParse().parseIfDefDirective();
		expect(par.isDone()).toBe(true);
		expect(par.diagnostics.length).toBe(0);
		expect(par.symbolUses.get('sym')?.length).toBe(1);
		expect(par.symbolUses.get('sym')?.[0].normText).toEqual('sym');
		expect(par.symbolUses.get('sym')?.[0].lineNumber).toEqual(7);
		expect(par.symbolUses.get('sym')?.[0].start).toEqual(7);
	});

	test('errors if missing symbol', () => {
		const par = new Parser('#ifdef', 7);
		par.startParse().parseIfDefDirective();
		expect(par.isDone()).toBe(true);
		expect(par.diagnostics.length).toBe(1);
		expect(par.diagnostics[0].message.includes('Missing symbol')).toBe(true);
	});

	test('errors if token before keyword', () => {
		const par = new Parser('sym #ifdef', 7);
		par.startParse().parseIfDefDirective();
		expect(par.isDone()).toBe(true);
		expect(par.diagnostics.length).toBe(1);
		expect(par.diagnostics[0].message.includes('before')).toBe(true);
	});
});

describe('handleUnrecognizedHashDirective', () => {
	test('does nothing if does not start with #', () => {
		const par = new Parser('sym: lda #$ff', 7);
		par.startParse().handleUnrecognizedHashDirective();
		expect(par.isDone()).toBe(false);
		expect(par.diagnostics.length).toBe(0);
	});

	test('reports unrecognized conditional assembly directive', () => {
		const par = new Parser('#$ff lda sym:', 7);
		par.startParse().handleUnrecognizedHashDirective();
		expect(par.isDone()).toBe(true);
		expect(par.diagnostics.length).toBe(1);
	});
});

describe('parseMacroDefinitionStart', () => {
	test('does nothing if not macro definition', () => {
		const par = new Parser('sym: lda #$ff', 7);
		par.startParse().parseMacroDefinitionStart();
		expect(par.isDone()).toBe(false);
		expect(par.diagnostics.length).toBe(0);
		expect(par.pos).toBe(0);
	});

	test('macro start, no args', () => {
		const par = new Parser('macro name()', 7);
		par.startParse().parseMacroDefinitionStart();
		expect(par.isDone()).toBe(true);
		expect(par.diagnostics.length).toBe(0);
		expect(par.macroDefinitions.length).toBe(1);
		expect(par.macroDefinitions[0].lineNumber).toBe(7);
		expect(par.macroDefinitions[0].normText).toBe('name');
	});

	test('macro start, one arg', () => {
		const par = new Parser('macro name(arg1)', 7);
		par.startParse().parseMacroDefinitionStart();
		expect(par.isDone()).toBe(true);
		expect(par.diagnostics.length).toBe(0);
		expect(par.macroDefinitions.length).toBe(1);
		expect(par.macroDefinitions[0].lineNumber).toBe(7);
		expect(par.macroDefinitions[0].normText).toBe('name');
	});

	test('macro start, three args', () => {
		const par = new Parser('macro name(arg1, arg2, arg3)', 7);
		par.startParse().parseMacroDefinitionStart();
		expect(par.isDone()).toBe(true);
		expect(par.diagnostics.length).toBe(0);
		expect(par.macroDefinitions.length).toBe(1);
		expect(par.macroDefinitions[0].lineNumber).toBe(7);
		expect(par.macroDefinitions[0].normText).toBe('name');
	});

	test('missing name', () => {
		const par = new Parser('macro (arg1, arg2, arg3)', 7);
		par.startParse().parseMacroDefinitionStart();
		expect(par.isDone()).toBe(true);
		expect(par.diagnostics.length).toBe(1);
		expect(par.diagnostics[0].message.includes('Missing name')).toBe(true);
		expect(par.macroDefinitions.length).toBe(0);
	});

	test('missing (', () => {
		const par = new Parser('macro name arg1, arg2, arg3)', 7);
		par.startParse().parseMacroDefinitionStart();
		expect(par.isDone()).toBe(true);
		expect(par.diagnostics.length).toBe(1);
		expect(par.diagnostics[0].message.includes('Missing (')).toBe(true);
		expect(par.macroDefinitions.length).toBe(0);
	});

	test('missing )', () => {
		const par = new Parser('macro name(arg1, arg2, arg3', 7);
		par.startParse().parseMacroDefinitionStart();
		expect(par.isDone()).toBe(true);
		expect(par.diagnostics.length).toBe(1);
		expect(par.diagnostics[0].message.includes('Missing )')).toBe(true);
		expect(par.macroDefinitions.length).toBe(0);
	});

	test('unexpected text after', () => {
		const par = new Parser('macro name(arg1, arg2, arg3) etc', 7);
		par.startParse().parseMacroDefinitionStart();
		expect(par.isDone()).toBe(true);
		expect(par.diagnostics.length).toBe(1);
		expect(par.diagnostics[0].message.includes('Unexpected')).toBe(true);
		expect(par.macroDefinitions.length).toBe(0);
	});
});

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
