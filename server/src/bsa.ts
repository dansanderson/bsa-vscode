import {
	Diagnostic,
	DiagnosticSeverity
} from 'vscode-languageserver/node';

import {
	ParseResults,
	mergeResults
} from './parse';

interface NumberedLine {
	line: string,
	number: number
}

function escapeForRegExp(s: string) {
    return s.replace(/[/\-\\^$*+?.()|[\]{}]/g, '\\$&');
}

function expectPat(pat: RegExp, line: string, pos: number) {
	const m = pat.exec(line.substring(pos));
	if (m) {
		return pos + m[0].length;
	}
	return null;
}

const emptyOrCommentPat = new RegExp('^\\s*(;.*)?$');
function expectEmptyOrComment(line: string, pos: number): number | null {
	return expectPat(emptyOrCommentPat, line, pos);
}

const namePat = new RegExp('^\\p{Letter}[\\w\\.]*', 'iu');
function expectName(line: string, pos: number): number | null {
	return expectPat(namePat, line, pos);
}

function makeLineError(numLine: NumberedLine, start: number, end: number, message: string): Diagnostic {
	return {
		severity: DiagnosticSeverity.Error,
		range: {
			start: { line: numLine.number, character: start },
			end: { line: numLine.number, character: end },
		},
		message: message
	};
}

export function parseLine(numLine: NumberedLine): ParseResults {
	const results: ParseResults = {
		diagnostics: []
	};

	let charIndex = 0;

	// Skip leading whitespace
	const trimmed = numLine.line.trimStart();
	charIndex = numLine.line.length - trimmed.length;

	// Star comment
	if (trimmed.startsWith('*')) {
		let i = charIndex + 1;
		while (/\s/.test(numLine.line.charAt(i))) {
			i++;
		}
		if (numLine.line.charAt(i) != '=') {
			return results;
		}
	}

	// TODO: Does BSA support #... not in the first column? With comment after?

	// Items that must appear alone on the line
	for (const term of ['#else', '#endif', 'endmac']) {
		const pat = new RegExp('^' + escapeForRegExp(term) + '\\b', 'i');
		if (pat.test(trimmed)) {
			if (expectEmptyOrComment(trimmed, term.length) == null) {
				results.diagnostics.push(makeLineError(
					numLine, charIndex, charIndex + term.length,
					term + ' must appear alone on the line'));
			}
			return results;
		}
	}

	// Conditional assembly directives
	if (/^#if\b/i.test(trimmed)) {
		// TODO: #if {expr}
		return results;
	}
	if (/^#ifdef\b/i.test(trimmed)) {
		// #ifdef {sym}
		const e = expectName(numLine.line, charIndex + 7);
		if (e == null) {
			results.diagnostics.push(makeLineError(
				numLine, charIndex, charIndex + 6,
				'Missing symbol for #ifdef'));
		} else if (expectEmptyOrComment(numLine.line, e) == null) {
			results.diagnostics.push(makeLineError(
				numLine, e, e,
				'Unexpected characters after #ifdef'));
		}
		return results;
	}
	if (/^#error\b/i.test(trimmed)) {
		// Any text can follow #error.
		return results;
	}

	if (trimmed.startsWith('#')) {
		results.diagnostics.push(makeLineError(
			numLine, charIndex, charIndex + 1,
			'Unrecognized assembler directive'));
		return results;
	}

	// Macro definition start
	if (/macro\b/i.test(trimmed)) {
		// TODO: macro {name}({arglist})
		// TODO: record macro definition location
	}

	// Assignment
	//   * = {expr}
	//   & = {expr}
	//   {sym} = {expr}

	// [{sym}:?] {pseudo-opcode} {args}
	// [{sym}:?] {opcode} {addr-expr}
	// [{sym}:?]
	// same for local labels (\d+\$)

	return results;
}

export function parseBsa(s: string): ParseResults {
	let lineNum = 0;
	const results = s.split('\n')
		.map((lineString) => { return { line: lineString, number: lineNum++ }; })
		.map(parseLine)
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
