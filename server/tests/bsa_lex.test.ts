import { expect } from '@jest/globals';

import * as assert from 'assert';

import { lexLine, Lexer, TokenType, Token } from '../src/bsa_lex';
import { DiagnosticSeverity } from 'vscode-languageserver';

describe('Lexer match', () => {
	test('match asserts pattern has "y" flag', () => {
		const lex = new Lexer('', 0);
		lex.match(/path with y flag/y);
		expect(() => {lex.match(/pat without y flag/);})
			.toThrow(assert.AssertionError);
	});

	test('match finds from beginning', () => {
		const lex = new Lexer('axbxcxd', 0);
		lex.start = 0;
		expect(lex.match(/.x/y)).toBe(true);
		expect(lex.end).toBe(2);
	});

	test('match finds after start position', () => {
		const lex = new Lexer('axbxcxd', 0);
		lex.start = 2;
		expect(lex.match(/.x/y)).toBe(true);
		expect(lex.end).toBe(4);
	});

	test('match does not find', () => {
		const lex = new Lexer('axbxcxd', 0);
		lex.start = 0;
		expect(lex.match(/.z/y)).toBe(false);
		expect(lex.end).toBe(0);
	});

	test('match does not find after start position', () => {
		const lex = new Lexer('azbxcxd', 0);
		lex.start = 2;
		lex.end = 2;
		expect(lex.match(/.z/y)).toBe(false);
		expect(lex.end).toBe(2);
	});
});

describe('Lexer general usage', () => {
	test('startLex without leading spaces', () => {
		const lex = new Lexer('text', 0);
		lex.startLex();
		expect(lex.start).toBe(0);
		expect(lex.end).toBe(0);
	});

	test('startLex consumes leading spaces', () => {
		const lex = new Lexer('   text', 0);
		lex.startLex();
		expect(lex.start).toBe(3);
		expect(lex.end).toBe(3);
	});

	test('isActive true after startLex', () => {
		const lex = new Lexer('   text', 0);
		lex.startLex();
		expect(lex.isActive()).toBe(true);
	});

	test('isActive false after successful match', () => {
		const lex = new Lexer('   text', 0);
		lex.startLex();
		expect(lex.match(/te/y)).toBe(true);
		expect(lex.isActive()).toBe(false);
	});

	test('isDone false after startLex', () => {
		const lex = new Lexer('   text', 0);
		lex.startLex();
		expect(lex.isDone()).toBe(false);
	});

	test('isDone false after partial match', () => {
		const lex = new Lexer('   text', 0);
		lex.startLex();
		expect(lex.match(/te/y)).toBe(true);
		expect(lex.isDone()).toBe(false);
	});

	test('isDone true after complete match', () => {
		const lex = new Lexer('   text', 0);
		lex.startLex();
		expect(lex.match(/text/y)).toBe(true);
		expect(lex.isDone()).toBe(true);
	});
});

describe('Lexer diagnostics', () => {
	test('addError adds an error with correct position', () => {
		const lex = new Lexer('   text', 7);
		lex.startLex();
		expect(lex.match(/te/y)).toBe(true);
		lex.addError('test message');
		expect(lex.diagnostics.length).toBe(1);
		expect(lex.diagnostics[0].severity).toBe(DiagnosticSeverity.Error);
		expect(lex.diagnostics[0].message).toEqual('test message');
		expect(lex.diagnostics[0].range.start.line).toBe(7);
		expect(lex.diagnostics[0].range.start.character).toBe(3);
		expect(lex.diagnostics[0].range.end.line).toBe(7);
		expect(lex.diagnostics[0].range.end.character).toBe(5);
	});

	test('addWarning adds a warning', () => {
		const lex = new Lexer('   text', 7);
		lex.startLex();
		expect(lex.match(/te/y)).toBe(true);
		lex.addWarning('test message');
		expect(lex.diagnostics.length).toBe(1);
		expect(lex.diagnostics[0].severity).toBe(DiagnosticSeverity.Warning);
	});
});

describe('Lexer addToken', () => {
	test('adds token with correct position', () => {
		const lex = new Lexer('   text', 7);
		lex.startLex();
		expect(lex.match(/te/y)).toBe(true);
		lex.addToken(TokenType.Keyword);
		expect(lex.tokens.length).toBe(1);
		expect(lex.tokens[0].type).toBe(TokenType.Keyword);
		expect(lex.tokens[0].lineNumber).toBe(7);
		expect(lex.tokens[0].start).toBe(3);
		expect(lex.tokens[0].end).toBe(5);
		expect(lex.tokens[0].normText).toBeUndefined();
	});

	test('adds token with optional normText', () => {
		const lex = new Lexer('   text', 7);
		lex.startLex();
		expect(lex.match(/te/y)).toBe(true);
		lex.addToken(TokenType.Keyword, 'TEST');
		expect(lex.tokens.length).toBe(1);
		expect(lex.tokens[0].type).toBe(TokenType.Keyword);
		expect(lex.tokens[0].lineNumber).toBe(7);
		expect(lex.tokens[0].start).toBe(3);
		expect(lex.tokens[0].end).toBe(5);
		expect(lex.tokens[0].normText).toEqual('TEST');
	});
});

describe('Lexer lexStarComment', () => {
	test('matches star comment', () => {
		const lex = new Lexer('   *** star comment', 7);
		lex.startLex().lexStarComment();
		expect(lex.isActive()).toBe(false);
		expect(lex.isDone()).toBe(true);
	});

	test('does not match PC assignment', () => {
		const lex = new Lexer('   * = $2001', 7);
		lex.startLex().lexStarComment();
		expect(lex.isActive()).toBe(true);
		expect(lex.isDone()).toBe(false);
		expect(lex.start).toBe(3);
		expect(lex.end).toBe(3);
	});
});

describe('Lexer lexLineComment', () => {
	test('matches line comment', () => {
		const lex = new Lexer('   ; line comment', 7);
		lex.startLex().lexLineComment();
		expect(lex.isActive()).toBe(false);
		expect(lex.isDone()).toBe(true);
	});

	test('does not match non-line comment', () => {
		const lex = new Lexer('   "; not a line comment"', 7);
		lex.startLex().lexLineComment();
		expect(lex.isActive()).toBe(true);
		expect(lex.isDone()).toBe(false);
		expect(lex.start).toBe(3);
		expect(lex.end).toBe(3);
	});
});

describe('Lexer lexStringLiteral', () => {
	test('matches single-quoted string', () => {
		const lex = new Lexer('   \'string\' etc.', 7);
		lex.startLex().lexStringLiteral();
		expect(lex.isActive()).toBe(false);
		expect(lex.start).toBe(3);
		expect(lex.end).toBe(11);
		expect(lex.tokens.length).toBe(1);
		expect(lex.tokens[0].type).toBe(TokenType.LiteralString);
	});

	test('matches single-quoted string with escapes', () => {
		const lex = new Lexer('   \'str\\\'\\ing\' etc.', 7);
		lex.startLex().lexStringLiteral();
		expect(lex.isActive()).toBe(false);
		expect(lex.start).toBe(3);
		expect(lex.end).toBe(14);
		expect(lex.tokens.length).toBe(1);
		expect(lex.tokens[0].type).toBe(TokenType.LiteralString);
	});

	test('matches double-quoted string', () => {
		const lex = new Lexer('   "string" etc.', 7);
		lex.startLex().lexStringLiteral();
		expect(lex.isActive()).toBe(false);
		expect(lex.start).toBe(3);
		expect(lex.end).toBe(11);
		expect(lex.tokens.length).toBe(1);
		expect(lex.tokens[0].type).toBe(TokenType.LiteralString);
	});

	test('matches double-quoted string with escapes', () => {
		const lex = new Lexer('   "str\\"\\ing" etc.', 7);
		lex.startLex().lexStringLiteral();
		expect(lex.isActive()).toBe(false);
		expect(lex.start).toBe(3);
		expect(lex.end).toBe(14);
		expect(lex.tokens.length).toBe(1);
		expect(lex.tokens[0].type).toBe(TokenType.LiteralString);
	});

	test('warns of unterminated string literal', () => {
		const lex = new Lexer('   "str\\"\\ing etc.', 7);
		lex.startLex().lexStringLiteral();
		expect(lex.isActive()).toBe(false);
		expect(lex.isDone()).toBe(true);
		expect(lex.diagnostics.length).toBe(1);
		expect(lex.diagnostics[0].severity).toBe(DiagnosticSeverity.Warning);
		expect(lex.tokens.length).toBe(1);
		expect(lex.tokens[0].type).toBe(TokenType.LiteralString);
	});
});

describe('Lexer lexKeyword', () => {
	test('matches "macro" keyword', () => {
		const lex = new Lexer('   Macro etc.', 7);
		lex.startLex().lexKeyword();
		expect(lex.isActive()).toBe(false);
		expect(lex.tokens.length).toBe(1);
		expect(lex.tokens[0].type).toBe(TokenType.Keyword);
		expect(lex.tokens[0].normText).toBe('macro');
		expect(lex.tokens[0].lineNumber).toBe(7);
		expect(lex.tokens[0].start).toBe(3);
		expect(lex.tokens[0].end).toBe(8);
	});

	test('does not match non-keyword name', () => {
		const lex = new Lexer('   acro etc.', 7);
		lex.startLex().lexKeyword();
		expect(lex.isActive()).toBe(true);
		expect(lex.tokens.length).toBe(0);
	});

	test('Token .bhex consumes entire line', () => {
		const s = '.BHEX 01,2b,c4  ; comment';
		const lex = new Lexer(s, 7);
		lex.startLex().lexKeyword();
		expect(lex.isActive()).toBe(false);
		expect(lex.isDone()).toBe(true);
		expect(lex.tokens.length).toBe(2);
		expect(lex.tokens[0].type).toBe(TokenType.Keyword);
		expect(lex.tokens[0].start).toBe(0);
		expect(lex.tokens[0].end).toBe(5);
		expect(lex.tokens[1].type).toBe(TokenType.RestOfLine);
		expect(lex.tokens[1].start).toBe(5);
		expect(lex.tokens[1].end).toBe(s.length);
	});

	test('Token #error consumes entire line', () => {
		const s = '#error some message';
		const lex = new Lexer(s, 7);
		lex.startLex().lexKeyword();
		expect(lex.isActive()).toBe(false);
		expect(lex.isDone()).toBe(true);
		expect(lex.tokens.length).toBe(2);
		expect(lex.tokens[0].type).toBe(TokenType.Keyword);
		expect(lex.tokens[0].start).toBe(0);
		expect(lex.tokens[0].end).toBe(6);
		expect(lex.tokens[1].type).toBe(TokenType.RestOfLine);
		expect(lex.tokens[1].start).toBe(6);
		expect(lex.tokens[1].end).toBe(s.length);
	});
});

describe('Lexer lexOperator', () => {
	test('matches >> operator', () => {
		const lex = new Lexer(' >>4', 7);
		lex.startLex().lexOperator();
		expect(lex.isActive()).toBe(false);
		expect(lex.isDone()).toBe(false);
		expect(lex.tokens.length).toBe(1);
		expect(lex.tokens[0].type).toBe(TokenType.Operator);
		expect(lex.tokens[0].normText).toEqual('>>');
		expect(lex.tokens[0].start).toBe(1);
		expect(lex.tokens[0].end).toBe(3);
	});

	test('matches > operator', () => {
		const lex = new Lexer(' >4', 7);
		lex.startLex().lexOperator();
		expect(lex.isActive()).toBe(false);
		expect(lex.isDone()).toBe(false);
		expect(lex.tokens.length).toBe(1);
		expect(lex.tokens[0].type).toBe(TokenType.Operator);
		expect(lex.tokens[0].normText).toEqual('>');
		expect(lex.tokens[0].start).toBe(1);
		expect(lex.tokens[0].end).toBe(2);
	});

	test('does not match non-operator', () => {
		const lex = new Lexer(' 4', 7);
		lex.startLex().lexOperator();
		expect(lex.isActive()).toBe(true);
	});
});

describe('Lexer lexName', () => {
	test('matches star', () => {
		const lex = new Lexer(' *=$2001', 7);
		lex.startLex().lexName();
		expect(lex.isActive()).toBe(false);
		expect(lex.isDone()).toBe(false);
		expect(lex.tokens.length).toBe(1);
		expect(lex.tokens[0].type).toBe(TokenType.Name);
		expect(lex.tokens[0].start).toBe(1);
		expect(lex.tokens[0].end).toBe(2);
		expect(lex.tokens[0].normText).toEqual('*');
	});

	test('matches ampersand', () => {
		const lex = new Lexer(' &=$2001', 7);
		lex.startLex().lexName();
		expect(lex.isActive()).toBe(false);
		expect(lex.isDone()).toBe(false);
		expect(lex.tokens.length).toBe(1);
		expect(lex.tokens[0].type).toBe(TokenType.Name);
		expect(lex.tokens[0].start).toBe(1);
		expect(lex.tokens[0].end).toBe(2);
		expect(lex.tokens[0].normText).toEqual('&');
	});

	test('matches label', () => {
		const lex = new Lexer(' loop:', 7);
		lex.startLex().lexName();
		expect(lex.isActive()).toBe(false);
		expect(lex.isDone()).toBe(false);
		expect(lex.tokens.length).toBe(1);
		expect(lex.tokens[0].type).toBe(TokenType.Name);
		expect(lex.tokens[0].start).toBe(1);
		expect(lex.tokens[0].end).toBe(5);
		expect(lex.tokens[0].normText).toEqual('loop');
	});

	test('matches label with numbers and dots', () => {
		const lex = new Lexer(' L12.34:', 7);
		lex.startLex().lexName();
		expect(lex.isActive()).toBe(false);
		expect(lex.isDone()).toBe(false);
		expect(lex.tokens.length).toBe(1);
		expect(lex.tokens[0].type).toBe(TokenType.Name);
		expect(lex.tokens[0].start).toBe(1);
		expect(lex.tokens[0].end).toBe(7);
		expect(lex.tokens[0].normText).toEqual('L12.34');
	});

	test('matches local label', () => {
		const lex = new Lexer(' 10$ lda #$ff', 7);
		lex.startLex().lexName();
		expect(lex.isActive()).toBe(false);
		expect(lex.isDone()).toBe(false);
		expect(lex.tokens.length).toBe(1);
		expect(lex.tokens[0].type).toBe(TokenType.Name);
		expect(lex.tokens[0].start).toBe(1);
		expect(lex.tokens[0].end).toBe(4);
		expect(lex.tokens[0].normText).toEqual('10$');
	});

	test('does not match non-name', () => {
		const lex = new Lexer(' 10 lda #$ff', 7);
		lex.startLex().lexName();
		expect(lex.isActive()).toBe(true);
		expect(lex.tokens.length).toBe(0);
	});
});

describe('Lexer lexNumber', () => {
	test('matches decimal integer', () => {
		const lex = new Lexer(' 10 + 5', 7);
		lex.startLex().lexNumber();
		expect(lex.isActive()).toBe(false);
		expect(lex.isDone()).toBe(false);
		expect(lex.tokens.length).toBe(1);
		expect(lex.tokens[0].type).toBe(TokenType.LiteralNumber);
		expect(lex.tokens[0].start).toBe(1);
		expect(lex.tokens[0].end).toBe(3);
	});

	test('matches decimal fraction, numbers on both sides of dot', () => {
		const lex = new Lexer(' 10.2 + 5', 7);
		lex.startLex().lexNumber();
		expect(lex.isActive()).toBe(false);
		expect(lex.isDone()).toBe(false);
		expect(lex.tokens.length).toBe(1);
		expect(lex.tokens[0].type).toBe(TokenType.LiteralNumber);
		expect(lex.tokens[0].start).toBe(1);
		expect(lex.tokens[0].end).toBe(5);
	});

	test('matches decimal fraction, numbers only left of dot', () => {
		const lex = new Lexer(' 10.+ 5', 7);
		lex.startLex().lexNumber();
		expect(lex.isActive()).toBe(false);
		expect(lex.isDone()).toBe(false);
		expect(lex.tokens.length).toBe(1);
		expect(lex.tokens[0].type).toBe(TokenType.LiteralNumber);
		expect(lex.tokens[0].start).toBe(1);
		expect(lex.tokens[0].end).toBe(4);
	});

	test('matches decimal fraction, numbers only right of dot', () => {
		const lex = new Lexer(' .2+ 5', 7);
		lex.startLex().lexNumber();
		expect(lex.isActive()).toBe(false);
		expect(lex.isDone()).toBe(false);
		expect(lex.tokens.length).toBe(1);
		expect(lex.tokens[0].type).toBe(TokenType.LiteralNumber);
		expect(lex.tokens[0].start).toBe(1);
		expect(lex.tokens[0].end).toBe(3);
	});

	test('matches hexadecimal', () => {
		const lex = new Lexer(' $adF0 + 5', 7);
		lex.startLex().lexNumber();
		expect(lex.isActive()).toBe(false);
		expect(lex.isDone()).toBe(false);
		expect(lex.tokens.length).toBe(1);
		expect(lex.tokens[0].type).toBe(TokenType.LiteralNumber);
		expect(lex.tokens[0].start).toBe(1);
		expect(lex.tokens[0].end).toBe(6);
	});

	test('matches binary', () => {
		const lex = new Lexer(' %01101000 + 5', 7);
		lex.startLex().lexNumber();
		expect(lex.isActive()).toBe(false);
		expect(lex.isDone()).toBe(false);
		expect(lex.tokens.length).toBe(1);
		expect(lex.tokens[0].type).toBe(TokenType.LiteralNumber);
		expect(lex.tokens[0].start).toBe(1);
		expect(lex.tokens[0].end).toBe(10);
	});

	test('does not match non-number', () => {
		const lex = new Lexer(' $gadF0 + 5', 7);
		lex.startLex().lexNumber();
		expect(lex.isActive()).toBe(true);
	});
});

describe('lexLine', () => {
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

	test('syntax error', () => {
		const results = lexLine(' $gadf', 7);
		expect(results.diagnostics.length).toBe(1);
		expect(results.tokens.length).toBe(0);
	});

	test('one label', () => {
		const results = lexLine('sym', 7);
		expect(results.tokens.length).toBe(1);
		expect(results.tokens[0].type).toBe(TokenType.Name);
	});

	test('one label with colon', () => {
		const results = lexLine('sym:', 7);
		expect(results.tokens.length).toBe(2);
		expect(results.tokens[0].type).toBe(TokenType.Name);
		expect(results.tokens[1].type).toBe(TokenType.Operator);
	});

});
