import {
	Diagnostic,
	DiagnosticSeverity
} from 'vscode-languageserver/node';

import { lexLine, Token, TokenType } from './bsa_lex';

export class Parser {
	diagnostics: Diagnostic[] = [];
	symbolDefinitions: Token[] = [];
	symbolUses: Map<string, Array<Token>> = new Map();
	macroDefinitions: Token[] = [];
	macroUses: Map<string, Array<Token>> = new Map();

	addDiagnosticForTokenRange(message: string, severity: DiagnosticSeverity, startToken: Token, endToken: Token) {
		this.diagnostics.push({
			severity: severity,
			range: {
				start: { line: startToken.lineNumber, character: startToken.start },
				end: { line: endToken.lineNumber, character: endToken.end },
			},
			message: message
		});
	}

	addDiagnosticForToken(message: string, severity: DiagnosticSeverity, token: Token) {
		this.addDiagnosticForTokenRange(message, severity, token, token);
	}

	parseLine(text: string, lineNumber: number) {
		const lexResults = lexLine(text, lineNumber);
		this.diagnostics.concat(lexResults.diagnostics);

		if (lexResults.tokens.length == 0) return;

		// Keywords that must appear alone on the line
		for (const kw of ['#else', '#endif', 'endmac']) {
			if (lexResults.tokens[0].type === TokenType.Keyword &&
					lexResults.tokens[0].normText === kw) {
				if (lexResults.tokens.length > 1) {
					this.addDiagnosticForToken(
						'Unexpected text after ' + lexResults.tokens[0].normText,
						DiagnosticSeverity.Error, lexResults.tokens[0]);
				}
			} else if (lexResults.tokens.length > 1) {
				for (let i = 1; i < lexResults.tokens.length; i++) {
					if (lexResults.tokens[i].normText === kw) {
						this.addDiagnosticForToken(
							'Unexpected text before ' + lexResults.tokens[i].normText,
							DiagnosticSeverity.Error, lexResults.tokens[i]);
					}
				}
			}
		}

		// TODO:
		// - #if {expr}
		// - #ifdef {sym}
		// - Unrecognized #... directive
		// - macro {sym}([arglist])
		//   - record macro definition
		// - Assignment
		//    * = {expr}
		//    & = {expr}
		//    {sym} = {expr}
		// - [{sym}:?] {macro-name} '(' [{expr} [',' {expr}...]] ')'
		//   - record macro use
		// - [{sym}:?] {pseudo-opcode} {args}
		// - [{sym}:?] {opcode} {addr-expr}
		// - [{sym}:?]
		//   - record label; ignore local labels (\d+\$)
		//
		// - expr parsing
		//   - record symbol use
		// - addressing mode parsing
		//   '#' {expr}
		//   {expr}
		//   {expr} ',' [xyz]
		//   '(' {expr} ')' ',' [xyz]
		//   '(' {expr} ',' [xy] ')'
		//   '(' {expr} ')'
		//   '[' {expr} ']' ',z'
		//   '[' {expr} ']'
	}
}

export function parseBsa(bodyText: string): Parser {
	const par = new Parser();
	let lineNum = 0;
	bodyText.split('\n').forEach((line) => par.parseLine(line, lineNum++));
	return par;
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
