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

describe('expectLabel', () => {
	test('empty does nothing', () => {
		const par = new Parser('', 7);
		expect(par.startParse().expectLabel()).toBeUndefined();
		expect(par.isDone()).toBe(true);
	});

	test('label records symbol definition', () => {
		const par = new Parser('foo lda #7', 7);
		const result = par.startParse().expectLabel();
		expect(result).toBeDefined();
		expect(par.pos).toBe(1);
		expect(par.symbolDefinitions[0].normText).toBe('foo');
	});

	test('label skips colon', () => {
		const par = new Parser('foo: lda #7', 7);
		const result = par.startParse().expectLabel();
		expect(result).toBeDefined();
		expect(par.pos).toBe(2);
		expect(par.symbolDefinitions[0].normText).toBe('foo');
	});

	test('local label does not record symbol definition', () => {
		const par = new Parser('10$ lda #7', 7);
		const result = par.startParse().expectLabel();
		expect(result).toBeDefined();
		expect(par.pos).toBe(1);
		expect(par.symbolDefinitions.length).toBe(0);
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

describe('parseIfDirective', () => {
	test('does nothing if not present', () => {
		const par = new Parser('sym: lda #$ff', 7);
		par.startParse().parseIfDirective();
		expect(par.isDone()).toBe(false);
		expect(par.diagnostics.length).toBe(0);
		expect(par.pos).toBe(0);
	});

	test('succeeds on valid statement', () => {
		const par = new Parser('#if sym', 7);
		par.startParse().parseIfDirective();
		expect(par.isDone()).toBe(true);
		expect(par.diagnostics.length).toBe(0);
		expect(par.symbolUses.get('sym')?.length).toBe(1);
		expect(par.symbolUses.get('sym')?.[0].normText).toEqual('sym');
		expect(par.symbolUses.get('sym')?.[0].lineNumber).toEqual(7);
		expect(par.symbolUses.get('sym')?.[0].start).toEqual(4);
	});

	test('succeeds on valid statement with complex expression', () => {
		const par = new Parser('#if >(sym + $c000 << 4) - %0100', 7);
		par.startParse().parseIfDirective();
		expect(par.isDone()).toBe(true);
		expect(par.diagnostics.length).toBe(0);
	});

	test('errors if missing symbol', () => {
		const par = new Parser('#if', 7);
		par.startParse().parseIfDirective();
		expect(par.diagnostics.length).toBe(1);
		expect(par.diagnostics[0].message.includes('Missing or invalid expression')).toBe(true);
	});

	test('errors if token before keyword', () => {
		const par = new Parser('sym #if', 7);
		par.startParse().parseIfDirective();
		expect(par.isDone()).toBe(true);
		expect(par.diagnostics.length).toBe(1);
		expect(par.diagnostics[0].message.includes('before')).toBe(true);
	});

	test('errors if token after #if statement', () => {
		const par = new Parser('#if sym foo', 7);
		par.startParse().parseIfDirective();
		expect(par.isDone()).toBe(true);
		expect(par.diagnostics.length).toBe(1);
		expect(par.diagnostics[0].message.includes('after')).toBe(true);
	});
});

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

	test('errors if text after #ifdef statement', () => {
		const par = new Parser('#ifdef sym foo', 7);
		par.startParse().parseIfDefDirective();
		expect(par.isDone()).toBe(true);
		expect(par.diagnostics.length).toBe(1);
		expect(par.diagnostics[0].message.includes('after')).toBe(true);
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

describe('parseAssignment', () => {
	test('assign to name', () => {
		const par = new Parser('foo = $b4', 7);
		par.startParse().parseAssignment();
		expect(par.isDone()).toBe(true);
		expect(par.diagnostics.length).toBe(0);
		expect(par.symbolDefinitions[0].normText).toEqual('foo');
	});

	test('assign to star', () => {
		const par = new Parser('* = $c000', 7);
		par.startParse().parseAssignment();
		expect(par.isDone()).toBe(true);
		expect(par.diagnostics.length).toBe(0);
		expect(par.symbolDefinitions.length).toBe(0);
	});

	test('assign to ampersand', () => {
		const par = new Parser('& = $c000', 7);
		par.startParse().parseAssignment();
		expect(par.isDone()).toBe(true);
		expect(par.diagnostics.length).toBe(0);
		expect(par.symbolDefinitions.length).toBe(0);
	});

	test('missing expression error', () => {
		const par = new Parser('foo =', 7);
		par.startParse().parseAssignment();
		expect(par.isDone()).toBe(true);
		expect(par.diagnostics.length).toBe(1);
		expect(par.symbolDefinitions.length).toBe(0);
		expect(par.diagnostics[0].message).toContain('Invalid assignment');
	});
});

describe('parseLabel', () => {
	test('empty line', () => {
		const par = new Parser('', 7);
		par.startParse().parseLabel();
		expect(par.pos).toBe(0);
		expect(par.symbolDefinitions.length).toBe(0);
	});

	test('label only', () => {
		const par = new Parser('foo', 7);
		par.startParse().parseLabel();
		expect(par.pos).toBe(1);
		expect(par.symbolDefinitions.length).toBe(1);
	});

	test('label with colon only', () => {
		const par = new Parser('foo:', 7);
		par.startParse().parseLabel();
		expect(par.pos).toBe(2);
		expect(par.symbolDefinitions.length).toBe(1);
	});

	test('macro call only', () => {
		const par = new Parser('foo()', 7);
		par.startParse().parseLabel();
		expect(par.pos).toBe(0);
		expect(par.symbolDefinitions.length).toBe(0);
	});

	test('opcode only', () => {
		const par = new Parser('lda #7', 7);
		par.startParse().parseLabel();
		expect(par.pos).toBe(0);
		expect(par.symbolDefinitions.length).toBe(0);
	});

	test('pseudo-op only', () => {
		const par = new Parser('.word 0', 7);
		par.startParse().parseLabel();
		expect(par.pos).toBe(0);
		expect(par.symbolDefinitions.length).toBe(0);
	});

	test('label and macro call', () => {
		const par = new Parser('foo bar()', 7);
		par.startParse().parseLabel();
		expect(par.pos).toBe(1);
		expect(par.symbolDefinitions.length).toBe(1);
	});

	test('label, colon, and macro call', () => {
		const par = new Parser('foo: bar()', 7);
		par.startParse().parseLabel();
		expect(par.pos).toBe(2);
		expect(par.symbolDefinitions.length).toBe(1);
	});
});

describe('parseMacroUse', () => {
	test('non-macro use', () => {
		const par = new Parser('lda #7', 7);
		par.startParse().parseMacroUse();
		expect(par.pos).toBe(0);
		expect(par.macroUses.has('lda')).toBe(false);
	});

	test('zero args', () => {
		const par = new Parser('foo()', 7);
		par.startParse().parseMacroUse();
		expect(par.isDone()).toBe(true);
		expect(par.macroUses.has('foo')).toBe(true);
	});

	test('one simple arg', () => {
		const par = new Parser('foo(7)', 7);
		par.startParse().parseMacroUse();
		expect(par.isDone()).toBe(true);
		expect(par.macroUses.has('foo')).toBe(true);
	});

	test('one complex arg', () => {
		const par = new Parser('foo(<(sym999 / $123a))', 7);
		par.startParse().parseMacroUse();
		expect(par.isDone()).toBe(true);
		expect(par.macroUses.has('foo')).toBe(true);
	});

	test('three args', () => {
		const par = new Parser('foo(123, abc, $bd00-%0100)', 7);
		par.startParse().parseMacroUse();
		expect(par.isDone()).toBe(true);
		expect(par.macroUses.has('foo')).toBe(true);
	});

	test('name without parens', () => {
		const par = new Parser('foo', 7);
		par.startParse().parseMacroUse();
		expect(par.isDone()).toBe(true);
		expect(par.diagnostics[0]?.message).toContain('Unexpected name');
	});

	test('missing closing paren', () => {
		const par = new Parser('foo(', 7);
		par.startParse().parseMacroUse();
		expect(par.isDone()).toBe(true);
		expect(par.diagnostics[0]?.message).toContain('Expected , or )');
	});

	test('missing comma', () => {
		const par = new Parser('foo(1 2)', 7);
		par.startParse().parseMacroUse();
		expect(par.isDone()).toBe(true);
		expect(par.diagnostics[0]?.message).toContain('Expected , or )');
	});

	test('invalid argument expression', () => {
		const par = new Parser('foo(2 +)', 7);
		par.startParse().parseMacroUse();
		expect(par.isDone()).toBe(true);
		expect(par.diagnostics.length).toBe(3);
		expect(par.diagnostics[2]?.message).toContain('Invalid macro argument');
	});

	test('text after macro call', () => {
		const par = new Parser('foo() lda #7', 7);
		par.startParse().parseMacroUse();
		expect(par.isDone()).toBe(true);
		expect(par.diagnostics[0]?.message).toContain('Unexpected text');
	});
});

// TODO: parsePseudoOp
// TODO: parseOpcode

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

	test('line with label only records label definition', () => {
		const par = parseLine('foo', 0);
		expect(par.diagnostics.length).toBe(0);
		expect(par.symbolDefinitions[0].normText).toBe('foo');
	});

	test('line with label and colon only', () => {
		const par = parseLine('foo:', 0);
		expect(par.diagnostics.length).toBe(0);
		expect(par.symbolDefinitions[0].normText).toBe('foo');
	});

	test('line with label only and comment', () => {
		const par = parseLine('foo   ; some comment', 0);
		expect(par.diagnostics.length).toBe(0);
		expect(par.symbolDefinitions[0].normText).toBe('foo');
	});

});

describe('parseBsa', () => {
	test('empty string returns empty results', () => {
		const results = parseBsa('');
		expect(results.diagnostics.length).toBe(0);
	});
});
