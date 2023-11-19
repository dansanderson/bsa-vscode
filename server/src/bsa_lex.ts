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
	'.pag', '.nam', '.subttl', '.end', '.case', '!src', '!addr'
];

const keywordPatterns: Array<KeywordPattern> = keywords.map((kw) => {
	return {
		keyword: kw,
		pat: RegExp(escapeForRegExp(kw) + '\\b', 'iy')
	};
});

// Operator tokens, in longest-to-shortest match order
const operators = [
	'==', '!=', '>=', '<=', '>>', '<<', '&&', '||',
	':', '^', '<', '>', '(', ')', '[', ']', '+', '-',
	'*', '/', '!', '~', '&', '|', '^'
];

const operatorPatterns: Array<KeywordPattern> = operators.map((kw) => {
	return {
		keyword: kw,
		pat: RegExp(escapeForRegExp(kw) + '\\b', 'iy')
	};
});

const spacePattern = /\s*/y;
const namePattern = /(\*|&|(\p{Letter}[\w.]*)|(\d+\$))/uy;
const starCommentPatterm = /\*\s*[^=].*$/y;
const errorDirectivePatterm = /#error\b.*$/iy;
const numberPattern = /(\$[0-9a-f]+)|(%[01]+)|([0-9]*\.[0-9]*)|([0-9]+))/iy;

export enum TokenType {
	LiteralString,
	LiteralNumber,
	Name,
	Keyword
}

export interface Token {
	type: TokenType,
	lineNumber: number,
	start: number,
	end: number,
	normText?: string
}

export class Lexer {
	public text: string;
	public lineNumber: number;
	public start: number = 0;
	public end: number = 0;
	public tokens: Array<Token> = [];
	public diagnostics: Array<Diagnostic> = [];

	constructor(text: string, lineNumber: number) {
		this.text = text;
		this.lineNumber = lineNumber;
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
		if (this.match(spacePattern)) this.end = this.start;
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
		if (starCommentPatterm.test(this.text))
			this.end = this.text.length;
		return this;
	}

	lexLineComment(): Lexer {
		// Rest of line matches line comment
		if (this.text.charAt(this.start) == ';')
			this.end = this.text.length;
		return this;
	}

	lexErrorDirective(): Lexer {
		// #error can be followed by any text
		if (errorDirectivePatterm.test(this.text))
			this.end = this.text.length;
		return this;
	}

	lexStringLiteral(): Lexer {
		if (!this.isActive()) return this;

		// BSA string literals cannot span lines, so this terminates an
		// unterminated literal at the end of the line with a warning.
		const firstChar = this.text.charAt(this.start);
		if (firstChar == "'" || firstChar == '"') {
			let sawEndQuote = false;
			while (this.end < this.text.length) {
				this.end++;
				if (this.text.charAt(this.end) == '\\') this.end++;
				if (this.text.charAt(this.end) == firstChar) {
					sawEndQuote = true;
					break;
				}
			}
			if (!sawEndQuote) {
				this.addWarning('Unterminated string literal goes to end of line');
			}

			this.addToken(TokenType.LiteralString);
		}

		return this;
	}

	lexKeyword(): Lexer {
		if (!this.isActive()) return this;
		for (const keywordPat of keywordPatterns) {
			if (this.match(keywordPat.pat)) {
				this.addToken(TokenType.Keyword, keywordPat.keyword);
				break;
			}
		}
		return this;
	}

	lexOperator(): Lexer {
		if (!this.isActive()) return this;
		for (const operatorPat of operatorPatterns) {
			if (this.match(operatorPat.pat)) {
				this.addToken(TokenType.Keyword, operatorPat.keyword);
				break;
			}
		}
		return this;
	}

	lexName(): Lexer {
		if (!this.isActive()) return this;
		if (this.match(namePattern)) {
			this.addToken(TokenType.Name);
		}
		return this;
	}

	lexNumber(): Lexer {
		if (!this.isActive()) return this;
		if (this.match(numberPattern)) {
			this.addToken(TokenType.LiteralNumber);
		}
		return this;
	}
}

export function lexLine(text: string, lineNumber: number): Lexer {
	let results: Lexer = new Lexer(text, lineNumber);

	results = results.startLex().lexStarComment();
	while (!results.isDone()) {
		results.startLex()
			.lexLineComment()
			.lexErrorDirective()
			.lexStringLiteral()
			.lexKeyword()
			.lexName()
			.lexNumber()
			.lexOperator();
	}

	return results;
}
