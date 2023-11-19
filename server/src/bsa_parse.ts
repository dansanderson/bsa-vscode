import {
	Diagnostic,
} from 'vscode-languageserver/node';

import { lexLine, Token, TokenType } from './bsa_lex';

export interface ParseResults {
	diagnostics: Diagnostic[];
}

export function mergeResults(first: ParseResults, second: ParseResults): ParseResults {
	return {
		diagnostics: first.diagnostics.concat(second.diagnostics)
	};
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
