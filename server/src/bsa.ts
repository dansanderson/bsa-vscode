import {
	Diagnostic,
	DiagnosticSeverity
} from 'vscode-languageserver/node';

import {
	ParseResults,
	mergeResults
} from './parse';

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

enum TokenType {
	LiteralString,
	LiteralNumber,
	Name,
	Keyword
}

interface Token {
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

export function parseLine(text: string, lineNumber: number): ParseResults {
	const results: ParseResults = {
		diagnostics: []
	};

	const lexResults = lexLine(text, lineNumber);
	results.diagnostics.concat(lexResults.diagnostics);

	// TODO: parse lexResults.tokens, accrue parser diagnostics
	// - Keywords that must appear alone on the line: ['#else', '#endif', 'endmac']
	// - #if {expr}
	// - #ifdef {sym}
	// - Unrecognized #... directive
	// - macro {sym}([arglist])
	//   - record macro definition
	// - Assignment
	//    * = {expr}
	//    & = {expr}
	//    {sym} = {expr}
	// - [{sym}:?] {pseudo-opcode} {args}
	// - [{sym}:?] {opcode} {addr-expr}
	// - [{sym}:?]
	//   - record label; ignore local labels (\d+\$)

	return results;
}

export function parseBsa(s: string): ParseResults {
	let lineNum = 0;
	const results = s.split('\n')
		.map((line) => parseLine(line, lineNum++))
		.reduce(mergeResults);

	return results;
}

// Symbol equal definition   ^\s*{sym}\s*=\s*{expr}
// Symbol PC definition      ^\s*{sym}\s*:?
// PC assignment             \*\s*={expr}
// BSS assignment            &\s*={expr}

// Local label               \d+\$
// Macro call: {sym}({args})
// Pseudoop: \.{sym}\s+{args}
// Opcode: ...
// Addressing modes:
//   #{expr}
//   {expr}
//   {expr},[xyz]
//   \({expr}\)
//   \({expr}\, x)
//   \({expr}\),[xyz]
//   \[{expr}\]
//   \[{expr}\],[xyz]
//   bbr# / bbs#  {expr},{label}
//   a

// Macro definition: MACRO {sym}({arglist}) ... ENDMAC
// Conditional assembly:
//    #if {expr}
//    #else
//    #endif
// - Can nest

// Literals: \d+ %[01]+ \$[\da-f]+ '...' "..." '...'^
// Operators: <... >... (...) [...] + - * / ! ~ & | ^
//            == != > < >= <= << >> && ||

// Pseudoops:
// WORD BIGW HEX4 DEC4 WOR BYTE BYT PET DISP BHEX BITS LITS QUAD REAL REAL4 FILL
// BSS STORE CPU BASE BASE ORG LOAD INCLUDE SIZE SKI PAG NAM SUBTTL END
// CASE
// !SRC !ADDR

// Multi-line conditions to check:
// - #if / #endif pairs (nesting, nesting limit, unclosed)

// Errors:
// Missing '+' or '-' after .CASE
// Missing '=' in set pc * instruction
// Missing '=' in set BSS & instruction
// Multiple assignments for label
// Multiple label definition
// {sym} = UNDEFINED
// Exponent %d out of range
// Wrong decimal constant or leading $ for hex missing
// Illegal character in decimal constant
// Missing ' delimiter after character operand
// Missing closing ] )
// Illegal operand
// Undefined symbol in WORD data
// Missing WORD data
// Illegal FILL multiplier  (range 0 - 32767)
// Missing '(' before FILL value
// Missing quoted filename after .INCLUDE
// Too many includes nested ( >= 99)
// Could not open include file
// Unsupported CPU type  (6502 65SC02 65C02 45GS02 65816)
// Illegal start address for STORE
// Missing ',' after start address
// Illegal length for STORE
// Missing ',' after length
// Missing quote for filename
// Illegal BSS size
// Illegal base page value
// use only '*' for 1 and '.' for 0 in BITS statement
// Undefined symbol in BYTE data
// Missing byte data
// Program counter overflow
// illegal address mode
// syntax error
// Illegal instruction or operand for CPU
// More than 10  #IF or #IFDEF conditions nested
// endif without if
// Undefined program counter (PC)
// Need direct page address, read
// Need two arguments
// Branch to undefined label
// Branch too long
// Branch to undefined label
// Operand cannot start with apostrophe
// Immediate value out of range
// base page value out of range
// Operand missing
// Operand syntax error
// Use of an undefined label
// Not a byte value
// Program counter exceeds 64 KB
// Syntax error in macro
// Wrong # of arguments in [%s] called (%d) defined (%d)
