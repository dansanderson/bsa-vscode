import {
	Diagnostic,
	DiagnosticSeverity
} from 'vscode-languageserver/node';

import assert = require('assert');

function escapeForRegExp(s: string) {
    return s.replace(/[/\-\\^$*+?.()|[\]{}]/g, '\\$&');
}

interface KeywordPattern {
	keyword: string,
	pat: RegExp
}

const keywords = [
	'#if', '#ifdef', '#else', '#endif', '#error', 'macro', 'endmac',
	'.word', '.bigw', '.hex4', '.dec4', '.wor', '.byte', '.byt', '.pet',
	'.disp', '.bhex', '.lits', '.quad', '.real', '.real4', '.fill', '.bss',
	'.store', '.cpu', '.base', '.org', '.load', '.include', '.size', '.ski',
	'.pag', '.nam', '.subttl', '.end', '.case', '!src', '!addr',
	'module'
];

const opcodes = [
	'adc', 'adcq', 'and', 'andq', 'asl', 'aslq', 'asr', 'asrq', 'asw',
	'bbr0', 'bbr1', 'bbr2', 'bbr3', 'bbr4', 'bbr5', 'bbr6', 'bbr7',
	'bbs0', 'bbs1', 'bbs2', 'bbs3', 'bbs4', 'bbs5', 'bbs6', 'bbs7',
	'bcc', 'bcs', 'beq', 'bmi', 'bne', 'bpl', 'bvc', 'bvs', 'bit',
	'bitq', 'bra', 'brk', 'bsr', 'clc', 'cld', 'cle', 'cli', 'clv',
	'cmp', 'cmpq', 'cpx', 'cpy', 'cpz', 'dec', 'deq', 'dew',
	'dex', 'dey', 'dez', 'eom', 'eor', 'eorq', 'inc',
	'inq', 'inw', 'inx', 'iny', 'inz', 'jmp', 'jsr', 'lda',
	'ldq', 'ldx', 'ldy', 'ldz', 'lsr', 'lsrq', 'map',
	'neg', 'ora', 'orq', 'pha', 'pla', 'phx', 'plx', 'phy', 'ply',
	'phz', 'plz', 'php', 'phw', 'plp',
	'rmb0', 'rmb1', 'rmb2', 'rmb3', 'rmb4', 'rmb5', 'rmb6', 'rmb7',
	'rol', 'ror', 'rolq', 'rorq', 'row', 'rti', 'rts', 'sbc',
	'sbcq', 'sec', 'sed', 'see', 'sei',
	'smb0', 'smb1', 'smb2', 'smb3', 'smb4', 'smb5', 'smb6', 'smb7',
	'sta', 'stq', 'stx', 'sty', 'stz', 'tab', 'tax', 'txa',
	'tay', 'tya', 'taz', 'tza', 'tba', 'tsx', 'tsy', 'trb', 'tsb',
	'txs', 'tys',

	'nop', // = 'eom'
	'aug', // = 'map'
	'bru', // = 'bra'
	'ina', // = 'inc a'
	'dea', // = 'dec a'

	// 65802 and 65816 instructions supported by BSA
	'phd', 'tcs', 'pld', 'tsa', 'tsc', 'wdm', 'mvp', 'phk', 'mvn',
    'tcd', 'rtl', 'tdc', 'phb', 'plb', 'tyx', 'wai', 'stp', 'swa',
    'xba', 'xce',

	// "L" long versions of branch instructions for 45GS02
	'lbpl', 'lbmi', 'lbvc', 'lbvs', 'lbcc', 'lbcs', 'lbne', 'lbeq',
	'lbra', 'lbru', 'lbsr'
];

const opcodePatterns: Array<KeywordPattern> = opcodes.map((kw) => {
	return {
		keyword: kw,
		pat: RegExp(escapeForRegExp(kw) + '\\b', 'iy')
	};
});


// Operator tokens, in longest-to-shortest match order
const operators = [
	'==', '!=', '>=', '<=', '>>', '<<', '&&', '||',
	':', '^', '<', '>', '(', ')', '[', ']', '+', '-',
	'*', '/', '!', '~', '&', '|', '^', ',', '#', '='
];

export enum TokenType {
	LiteralString,
	LiteralNumber,
	Name,
	Keyword,
	Operator,
	Opcode,
	RestOfLine
}

export interface Token {
	type: TokenType,
	lineNumber: number,
	start: number,
	end: number,
	normText?: string
}

export interface LexerResult {
	tokens: Array<Token>;
	diagnostics: Array<Diagnostic>;
}

export class Lexer {
	public start: number = 0;
	public end: number = 0;
	public tokens: Array<Token> = [];
	public diagnostics: Array<Diagnostic> = [];

	// These Regexps use "sticky" mode and have state, so they need to be recompiled per Lexer instance.
	private spacePattern = /\s*/y;
	private namePattern = /(\*|&|([\p{Letter}_][\w.]*)|(\d+\$))/uy;
	private starCommentPattern = /\s*\*(?!\s*=).*/y;
	private numberPattern = /((\$[0-9a-f]+)|(%[01]+)|(@[0-7]+)|([0-9]+\.[0-9]*)|(\.[0-9]+)|([0-9]+))/iy;
	private operatorPatterns: Array<KeywordPattern>;
	private keywordPatterns: Array<KeywordPattern>;

	constructor(
			public text: string,
			public lineNumber: number) {

		this.operatorPatterns = operators.map((kw) => {
			return {
				keyword: kw,
				pat: RegExp(escapeForRegExp(kw), 'y')
			};
		});

		this.keywordPatterns = keywords.map((kw) => {
			return {
				keyword: kw,
				pat: RegExp(escapeForRegExp(kw) + '\\b', 'iy')
			};
		});

	}

	match(pat: RegExp) {
		assert (pat.flags.includes('y'));
		pat.lastIndex = this.start;
		const result = pat.exec(this.text);
		if (result !== null) {
			this.end = this.start + result[0].length;
		}
		return result !== null;
	}

	startLex() {
		this.start = this.end;
		if (this.match(this.spacePattern)) this.start = this.end;
		return this;
	}

	isActive() {
		return this.end === this.start;
	}

	isDone() {
		return this.end === this.text.length;
	}

	addDiagnostic(message: string, severity: DiagnosticSeverity) {
		this.diagnostics.push({
			severity: severity,
			range: {
				start: { line: this.lineNumber, character: this.start },
				end: { line: this.lineNumber, character: this.end },
			},
			message: message
		});
	}

	addWarning(message: string) {
		this.addDiagnostic(message, DiagnosticSeverity.Warning);
	}

	addError(message: string) {
		this.addDiagnostic(message, DiagnosticSeverity.Error);
	}

	addToken(type: TokenType, normText?: string) {
		this.tokens.push({
			type: type,
			lineNumber: this.lineNumber,
			start: this.start,
			end: this.end,
			normText: normText
		});
	}

	lexStarComment(): Lexer {
		// Entire line matches star comment
		if (this.starCommentPattern.test(this.text))
			this.end = this.text.length;
		return this;
	}

	lexLineComment(): Lexer {
		// Rest of line matches line comment
		if (this.text.charAt(this.start) == ';')
			this.end = this.text.length;
		return this;
	}

	lexStringLiteral(): Lexer {
		if (!this.isActive()) return this;

		// BSA string literals cannot span lines, so this terminates an
		// unterminated literal at the end of the line with a warning.
		const firstChar = this.text.charAt(this.start);
		const stringChars = [];
		if (firstChar == "'" || firstChar == '"') {
			let sawEndQuote = false;
			this.end++;
			while (this.end < this.text.length) {
				if (this.text.charAt(this.end) == firstChar) {
					sawEndQuote = true;
					this.end++;
					break;
				}
				if (this.text.charAt(this.end) == '\\') this.end++;
				stringChars.push(this.text.charAt(this.end));
				this.end++;
			}
			if (!sawEndQuote) {
				this.addWarning('Unterminated string literal goes to end of line');
			}

			this.addToken(TokenType.LiteralString, stringChars.join(''));
		}

		return this;
	}

	lexKeyword(): Lexer {
		if (!this.isActive()) return this;
		for (const keywordPat of this.keywordPatterns) {
			if (this.match(keywordPat.pat)) {
				this.addToken(TokenType.Keyword, keywordPat.keyword);

				// Special case directives whose arguments don't lex normally.
				if (keywordPat.keyword === '.bhex' ||
						keywordPat.keyword === '#error') {
					this.start = this.end;
					this.end = this.text.length;
					this.addToken(TokenType.RestOfLine);
				}

				break;
			}
		}
		return this;
	}

	lexOperator(): Lexer {
		if (!this.isActive()) return this;
		for (const operatorPat of this.operatorPatterns) {
			if (this.match(operatorPat.pat)) {
				this.addToken(TokenType.Operator, operatorPat.keyword);
				break;
			}
		}
		return this;
	}

	lexOpcode(): Lexer {
		if (!this.isActive()) return this;
		for (const opcodePat of opcodePatterns) {
			if (this.match(opcodePat.pat)) {
				this.addToken(TokenType.Opcode, opcodePat.keyword);
				break;
			}
		}
		return this;
	}

	lexName(): Lexer {
		if (!this.isActive()) return this;
		if (this.match(this.namePattern)) {
			this.addToken(TokenType.Name, this.text.substring(this.start, this.end));
		}
		return this;
	}

	lexNumber(): Lexer {
		if (!this.isActive()) return this;
		if (this.match(this.numberPattern)) {
			this.addToken(TokenType.LiteralNumber);
		}
		return this;
	}
}

export function lexLine(text: string, lineNumber: number): LexerResult {
	let results: Lexer = new Lexer(text, lineNumber);

	results = results.startLex().lexStarComment();
	while (!results.isDone()) {
		results.startLex()
			.lexLineComment()
			.lexStringLiteral()
			.lexOpcode()
			.lexKeyword()
			.lexOperator()
			.lexName()
			.lexNumber();
		if (results.isActive()) {
			results.addError('Syntax error');
			break;
		}
	}

	return {
		tokens: results.tokens,
		diagnostics: results.diagnostics
	};
}
