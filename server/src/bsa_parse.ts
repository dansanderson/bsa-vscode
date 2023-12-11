import {
	Diagnostic,
	DiagnosticSeverity
} from 'vscode-languageserver/node';

import { LexerResult, lexLine, Token, TokenType } from './bsa_lex';

const unaryOperators = [
	'+', '-', '!', '~', '<', '>'
];

const binaryOperators = [
	'==', '!=', '>=', '<=', '>>', '<<', '&&', '||',
	'+', '-', '*', '/', '&', '|', '^'
];

interface OperatorPriorities { [key: string]: number; }
const binaryOperatorPriorites: OperatorPriorities = {
	'*': 11,
	'/': 11,
	'+': 10,
	'-': 10,
	'<<': 9,
	'>>': 9,
	'<=': 8,
	'<': 8,
	'>=': 8,
	'>': 8,
	'==': 7,
	'!=': 7,
	'&': 6,
	'^': 5,
	'|': 4,
	'&&': 3,
	'||': 2
};

export interface ParserResult {
	diagnostics: Diagnostic[];
	symbolDefinitions: Token[];
	symbolUses: Map<string, Array<Token>>;
	symbolUsesByLine: Map<number, Array<Token>>;
	macroDefinitions: Token[];
	macroUses: Map<string, Array<Token>>;
	macroUsesByLine: Map<number, Array<Token>>;
}

export function addToMapOfList<K,V>(mapOfList: Map<K, Array<V>>, key: K, value: V) {
	if (!key) return;
	if (!mapOfList.has(key)) {
		mapOfList.set(key, [value]);
	} else {
		mapOfList.get(key)?.push(value);
	}
}

export function mergeMapOfListLeft<K,V>(first: Map<K, Array<V>>, second: Map<K, Array<V>>) {
	second.forEach((v,k) => {
		if (!first.has(k)) {
			first.set(k, v.slice());
		} else {
			first.set(k, first.get(k)?.concat(v) || []);
		}
	});
	return first;
}

export function mergeParserResultsLeft(first: ParserResult, second: ParserResult): ParserResult {
	first.diagnostics = first.diagnostics.concat(second.diagnostics);
	first.symbolDefinitions = first.symbolDefinitions.concat(second.symbolDefinitions);
	first.macroDefinitions = first.macroDefinitions.concat(second.macroDefinitions);

	mergeMapOfListLeft(first.symbolUses, second.symbolUses);
	mergeMapOfListLeft(first.symbolUsesByLine, second.symbolUsesByLine);
	mergeMapOfListLeft(first.macroUses, second.macroUses);
	mergeMapOfListLeft(first.macroUsesByLine, second.macroUsesByLine);

	return first;
}

export class Parser {
	diagnostics: Diagnostic[] = [];
	symbolDefinitions: Token[] = [];
	symbolUses: Map<string, Array<Token>> = new Map();
	symbolUsesByLine: Map<number, Array<Token>> = new Map();
	macroDefinitions: Token[] = [];
	macroUses: Map<string, Array<Token>> = new Map();
	macroUsesByLine: Map<number, Array<Token>> = new Map();
	pos: number = 0;
	lex: LexerResult;

	constructor(
			public text: string,
			public lineNumber: number) {
		this.lex = lexLine(this.text, this.lineNumber);
		this.diagnostics.concat(this.lex.diagnostics);
	}

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

	addSymbolUse(tok: Token) {
		addToMapOfList(this.symbolUses, tok.normText, tok);
		addToMapOfList(this.symbolUsesByLine, tok.lineNumber, tok);
	}

	addSymbolDefinition(tok: Token) {
		this.symbolDefinitions.push(tok);
		this.addSymbolUse(tok);
	}

	addMacroUse(tok: Token) {
		addToMapOfList(this.macroUses, tok.normText, tok);
		addToMapOfList(this.macroUsesByLine, tok.lineNumber, tok);
	}

	addMacroDefinition(tok: Token) {
		this.macroDefinitions.push(tok);
		this.addMacroUse(tok);
	}

	startParse() {
		this.pos = 0;
		return this;
	}

	isDone() {
		return this.pos === this.lex.tokens.length;
	}

	expectToken(type: TokenType) {
		if (this.isDone()) return undefined;
		if (this.lex.tokens[this.pos].type === type) {
			return this.lex.tokens[this.pos++];
		}
		return undefined;
	}

	expectTokenWithText(type: TokenType, text: string) {
		if (this.isDone()) return undefined;
		if (this.lex.tokens[this.pos].type === type &&
				this.lex.tokens[this.pos].normText === text) {
			return this.lex.tokens[this.pos++];
		}
		return undefined;
	}

	isLocalLabel(tok: Token) {
		return (tok.type === TokenType.Name &&
			!!(tok.normText || '').match(/^\d+\$$/));
	}

	expectLabel() {
		const tok = this.expectToken(TokenType.Name);
		if (!tok) return undefined;
		this.expectTokenWithText(TokenType.Operator, ':');
		if (!this.isLocalLabel(tok)) this.addSymbolDefinition(tok);
		return tok;
	}

	isStarOrAmpersand(tok: Token): boolean {
		return (tok.type === TokenType.Operator &&
			(tok.normText === '*' ||
			tok.normText === '&'));
	}

	isSimpleOperand(tok: Token): boolean {
		return (tok.type === TokenType.LiteralNumber ||
			this.isStarOrAmpersand(tok) ||
			tok.type === TokenType.Name ||
			(tok.type === TokenType.LiteralString && tok.normText?.length === 1));
	}

	expectExpression(priority: number = 0): boolean {
		if (this.isDone()) return false;

		// First token is operator. Comma? Bracket? Unary?
		if (this.lex.tokens[this.pos].type === TokenType.Operator &&
				!this.isStarOrAmpersand(this.lex.tokens[this.pos])) {
			const txt = this.lex.tokens[this.pos].normText;

			// Comma?
			if (txt === ',') {
				return false;
			}

			// Brackets?
			if (txt === '(' || txt === '[') {
				this.pos++;
				const closing = (txt === '(' ? ')' : ']');
				if (this.expectExpression(0) == false) {
					return false;
				}
				if (this.expectTokenWithText(TokenType.Operator, closing) === undefined) {
					this.addDiagnosticForToken(
						'Expected closing bracket: ' + closing,
						DiagnosticSeverity.Error,
						this.lex.tokens[this.pos-1]);
					return false;
				}
				// Continue...

			// Unary operator?
			} else if (unaryOperators.some(op => txt == op)) {
				this.pos++;
				if (!this.expectExpression(12)) {
					return false;
				}
				// Continue...

			// Unexpected operator at beginning of expression
			} else {
				this.addDiagnosticForToken(
					'Unexpected operator',
					DiagnosticSeverity.Error,
					this.lex.tokens[this.pos]);
				return false;
			}

		// First token is not operator. Literal or symbol term OK, otherwise error.
		// Single character string literal is treated as a number literal.
		} else if (!this.isSimpleOperand(this.lex.tokens[this.pos])) {
			this.addDiagnosticForToken(
				'Illegal operand',
				DiagnosticSeverity.Error,
				this.lex.tokens[this.pos]);
			return false;

		} else {
			if (this.lex.tokens[this.pos].type === TokenType.Name &&
					!this.isLocalLabel(this.lex.tokens[this.pos])) {
				this.addSymbolUse(this.lex.tokens[this.pos]);
			}
			this.pos++;
		}

		// One term has been parsed. Is this part of a binary operator expression?
		for (;;) {
			if (this.isDone() ||
					this.lex.tokens[this.pos].type !== TokenType.Operator ||
					!binaryOperators.some(op => this.lex.tokens[this.pos].normText == op)) {
				return true;
			}

			const opPriority = binaryOperatorPriorites[this.lex.tokens[this.pos].normText || ''];
			if (opPriority <= priority) return true;

			this.pos++;
			if (!this.expectExpression(opPriority)) {
				this.addDiagnosticForToken(
					'Missing operand',
					DiagnosticSeverity.Error,
					this.lex.tokens[this.pos-1]);
				return false;
			}
		}
	}

	parseSoloTokens() {
		if (this.isDone()) return this;

		// Keywords that must appear alone on the line
		for (const kw of ['#else', '#endif', 'endmac']) {
			if (this.pos === 0 && !!this.expectTokenWithText(TokenType.Keyword, kw)) {
				if (this.lex.tokens.length > 1) {
					this.addDiagnosticForToken(
						'Unexpected text after ' + this.lex.tokens[0].normText,
						DiagnosticSeverity.Error, this.lex.tokens[0]);
				}
				this.pos = this.lex.tokens.length;
			} else if (this.lex.tokens.length > 1) {
				let foundErrant = false;
				const prevPos = this.pos;
				for (this.pos = 1; this.pos < this.lex.tokens.length; this.pos++) {
					if (this.expectTokenWithText(TokenType.Keyword, kw)) {
						foundErrant = true;
						this.addDiagnosticForToken(
							'Unexpected text before ' + kw,
							DiagnosticSeverity.Error, this.lex.tokens[this.pos - 1]);
						// (length - 1 because for() increments one more time)
						this.pos = this.lex.tokens.length - 1;
					}
				}
				if (!foundErrant) this.pos = prevPos;
			}
		}

		return this;
	}

	parseIfDirective() {
		if (this.isDone()) return this;

		// #if {expr}
		if (this.pos === 0 && !!this.expectTokenWithText(TokenType.Keyword, '#if')) {
			if (!this.expectExpression(0)) {
				this.addDiagnosticForToken(
					'Missing or invalid expression for #if',
					DiagnosticSeverity.Error, this.lex.tokens[0]);
			} else if (this.pos < this.lex.tokens.length && this.lex.tokens[this.pos].type !== TokenType.RestOfLine) {
				this.addDiagnosticForToken(
					'Unexpected text after #if',
					DiagnosticSeverity.Error, this.lex.tokens[0]);
			}
			this.pos = this.lex.tokens.length;
		} else if (this.lex.tokens.length > 1) {
			let foundErrant = false;
			const prevPos = this.pos;
			for (this.pos = 1; this.pos < this.lex.tokens.length; this.pos++) {
				if (this.expectTokenWithText(TokenType.Keyword, '#if')) {
					foundErrant = true;
					this.addDiagnosticForToken(
						'Unexpected text before #if',
						DiagnosticSeverity.Error, this.lex.tokens[this.pos - 1]);
					// (length - 1 because for() increments one more time)
					this.pos = this.lex.tokens.length - 1;
				}
			}
			if (!foundErrant) this.pos = prevPos;
		}

		return this;
	}

	parseIfDefDirective() {
		if (this.isDone()) return this;

		// #ifdef {sym}
		if (this.pos === 0 && !!this.expectTokenWithText(TokenType.Keyword, '#ifdef')) {
			const nameTok = this.expectToken(TokenType.Name);
			if (nameTok) {
				if (!this.isLocalLabel(nameTok))
					this.addSymbolUse(nameTok);
				if (this.pos < this.lex.tokens.length && this.lex.tokens[this.pos].type !== TokenType.RestOfLine) {
					this.addDiagnosticForToken(
						'Unexpected text after #ifdef',
						DiagnosticSeverity.Error, this.lex.tokens[0]);
				}
			} else {
				this.addDiagnosticForToken(
					'Missing symbol for #ifdef',
					DiagnosticSeverity.Error, this.lex.tokens[0]);
			}
			this.pos = this.lex.tokens.length;
		} else if (this.lex.tokens.length > 1) {
			let foundErrant = false;
			const prevPos = this.pos;
			for (this.pos = 1; this.pos < this.lex.tokens.length; this.pos++) {
				if (this.expectTokenWithText(TokenType.Keyword, '#ifdef')) {
					foundErrant = true;
					this.addDiagnosticForToken(
						'Unexpected text before #ifdef',
						DiagnosticSeverity.Error, this.lex.tokens[this.pos - 1]);
					// (length - 1 because for() increments one more time)
					this.pos = this.lex.tokens.length - 1;
				}
			}
			if (!foundErrant) this.pos = prevPos;
		}

		return this;
	}

	handleUnrecognizedHashDirective() {
		if (this.isDone()) return this;

		if (this.pos === 0 && !!this.expectTokenWithText(TokenType.Operator, '#')) {
			this.addDiagnosticForToken(
				'Unrecognized conditional assembly directive',
				DiagnosticSeverity.Error, this.lex.tokens[0]);
			this.pos = this.lex.tokens.length;
		}

		return this;
	}

	parseMacroDefinitionStart() {
		if (this.isDone()) return this;

		if (this.expectTokenWithText(TokenType.Keyword, 'macro')) {
			const nameTok = this.expectToken(TokenType.Name);
			if (nameTok) {
				if (!this.expectTokenWithText(TokenType.Operator, '(')) {
					this.addDiagnosticForToken(
						'Missing ( for macro definition',
						DiagnosticSeverity.Error, nameTok);
				} else {
					let expectArgs = true;
					while (expectArgs && this.expectToken(TokenType.Name)) {
						expectArgs = !!this.expectTokenWithText(TokenType.Operator, ',');
					}

					if (!this.expectTokenWithText(TokenType.Operator, ')')) {
						this.addDiagnosticForToken(
							'Missing ) for macro definition',
							DiagnosticSeverity.Error,
							nameTok);
					} else if (!this.isDone()) {
						this.addDiagnosticForToken(
							'Unexpected text after macro definition start',
							DiagnosticSeverity.Error, this.lex.tokens[this.pos]);
					} else {
						this.addMacroDefinition(nameTok);
					}
				}
			} else {
				this.addDiagnosticForToken(
					'Missing name for macro definition',
					DiagnosticSeverity.Error, this.lex.tokens[this.pos]);
			}
			this.pos = this.lex.tokens.length;
		}

		return this;
	}

	parseAssignment() {
		if (this.isDone()) return this;

		const startPos = this.pos;
		const nameTok = (this.expectToken(TokenType.Name) ||
			this.expectTokenWithText(TokenType.Operator, '*') ||
			this.expectTokenWithText(TokenType.Operator, '&'));
		if (!nameTok) return this;
		if (!this.expectTokenWithText(TokenType.Operator, '=')) {
			this.pos = startPos;
			return this;
		}
		if (!this.expectExpression(0)) {
			this.addDiagnosticForToken(
				'Invalid assignment expression',
				DiagnosticSeverity.Error, this.lex.tokens[this.pos-1]);
		} else {
			if (nameTok.normText !== '*' && nameTok.normText !== '&')
				this.addSymbolDefinition(nameTok);
		}
		this.pos = this.lex.tokens.length;

		return this;
	}

	parseLabel() {
		if (this.isDone()) return this;

		// Handle label, disambiguating between labeled line and
		// unlabeled macro use or assignment.
		// (Star assignments can be labeled, so label is consumed before assignment.)
		let labelTok = undefined;
		if (this.lex.tokens[this.pos]?.type === TokenType.Name) {
			const secondTok = this.lex.tokens[this.pos+1];
			if (secondTok?.type !== TokenType.Operator ||
					(secondTok?.normText !== '(' && secondTok?.normText !== '=')) {
				labelTok = this.expectLabel();
			}
		}

		return this;
	}

	parseMacroUse() {
		if (this.isDone()) return this;

		const macroUseTok = this.expectToken(TokenType.Name);
		if (!macroUseTok) return this;

		if (!this.expectTokenWithText(TokenType.Operator, '(')) {
			this.addDiagnosticForToken(
				'Unexpected name; maybe macro call missing () ?',
				DiagnosticSeverity.Error, macroUseTok);
		} else {
			let sawComma = true;
			let sawArgumentError = false;
			while (!this.expectTokenWithText(TokenType.Operator, ')')) {
				if (this.isDone() || !sawComma) {
					this.addDiagnosticForToken(
						'Expected , or )',
						DiagnosticSeverity.Error, this.lex.tokens[this.pos-1]);
					sawArgumentError = true;
					break;
				}
				if (!this.expectExpression(0)) {
					this.addDiagnosticForToken(
						'Invalid macro argument',
						DiagnosticSeverity.Error, this.lex.tokens[this.pos-1]);
					sawArgumentError = true;
					break;
				}
				sawComma = !!this.expectTokenWithText(TokenType.Operator, ',');
			}

			if (!sawArgumentError) {
				if (!this.isDone()) {
					this.addDiagnosticForToken(
						'Unexpected text after macro call',
						DiagnosticSeverity.Error, this.lex.tokens[this.pos]);
				} else {
					this.addMacroUse(macroUseTok);
				}
			}
		}

		this.pos = this.lex.tokens.length;
		return this;
	}

	parsePseudoOp() {
		if (this.isDone()) return this;

		const keywordTok = this.expectToken(TokenType.Keyword);
		if (!keywordTok) return this;

		// TODO: parse pseudo-op args

		this.pos = this.lex.tokens.length;
		return this;
	}

	parseOpcode() {
		const opcodeTok = this.expectToken(TokenType.Opcode);
		if (!opcodeTok) return this;

		const firstTok = this.lex.tokens[this.pos];
		if (this.expectTokenWithText(TokenType.Operator, '#')) {
			// '#' {expr}
			if (!this.expectExpression(0)) {
				this.addDiagnosticForToken(
					'Invalid expression for immediate',
					DiagnosticSeverity.Error, firstTok);
			}

		} else if (this.expectTokenWithText(TokenType.Operator, '(') ||
				this.expectTokenWithText(TokenType.Operator, '[')) {
			// '(' {expr} ')' ',' [xyz]
			// '(' {expr} ',' [xy|sp] ')'
			// '(' {expr} ')'
			// '[' {expr} ']' ',z'
			// '[' {expr} ']'
			const isParen = firstTok.normText === '(';
			if (!this.expectExpression(0)) {
				this.addDiagnosticForToken(
					'Invalid expression for indirect',
					DiagnosticSeverity.Error, firstTok);
			}
			if (isParen) {
				if (this.expectTokenWithText(TokenType.Operator, ',')) {
					const xyOp = this.expectToken(TokenType.Name);
					if (!xyOp ||
							(xyOp.normText?.toLowerCase() !== 'x' &&
							xyOp.normText?.toLowerCase() !== 'y' &&
							xyOp.normText?.toLowerCase() !== 'sp')) {
						this.addDiagnosticForToken(
							'Invalid indirect index register',
							DiagnosticSeverity.Error, firstTok);
					}
				}
				if (!this.expectTokenWithText(TokenType.Operator, ')')) {
					this.addDiagnosticForToken(
						'Expected )',
						DiagnosticSeverity.Error, this.lex.tokens[this.pos-1]);
				} else {
					if (this.expectTokenWithText(TokenType.Operator, ',')) {
						const xyOp = this.expectToken(TokenType.Name);
						if (!xyOp ||
								(xyOp.normText?.toLowerCase() !== 'x' &&
								xyOp.normText?.toLowerCase() !== 'y' &&
								xyOp.normText?.toLowerCase() !== 'z')) {
							this.addDiagnosticForToken(
								'Invalid index indirect register',
								DiagnosticSeverity.Error, firstTok);
						}
					}
				}
			} else {
				if (!this.expectTokenWithText(TokenType.Operator, ']')) {
					this.addDiagnosticForToken(
						'Expected ]',
						DiagnosticSeverity.Error, this.lex.tokens[this.pos-1]);
				} else {
					if (this.expectTokenWithText(TokenType.Operator, ',')) {
						const xyOp = this.expectToken(TokenType.Name);
						if (!xyOp || xyOp.normText?.toLowerCase() !== 'z') {
							this.addDiagnosticForToken(
								'Invalid index indirect register',
								DiagnosticSeverity.Error, firstTok);
						}
					}
				}
			}

		} else {
			// (none)
			// {expr}
			// {expr} ',' {expr}
			//    (This covers {expr} ',' [xyz] as well as bbr-style {expr} ',' {expr}.)
			if (!this.isDone()) {
				if (!this.expectExpression(0)) {
					this.addDiagnosticForToken(
						'Invalid address expression for opcode',
						DiagnosticSeverity.Error, firstTok);
				} else {
					if (this.expectTokenWithText(TokenType.Operator, ',')) {
						if (!this.expectExpression(0)) {
							this.addDiagnosticForToken(
								'Invalid index register or relative label',
								DiagnosticSeverity.Error, firstTok);
						}
					}
				}
			}
		}

		this.pos = this.lex.tokens.length;
		return this;
	}
}

export function parseLine(text: string, lineNumber: number): ParserResult {
	const par = new Parser(text, lineNumber)
		.startParse()
		.parseSoloTokens()
		.parseIfDirective()
		.parseIfDefDirective()
		.handleUnrecognizedHashDirective()
		.parseMacroDefinitionStart()
		// Always before any line type that can start with a label:
		.parseLabel()
		.parseAssignment()
		.parseMacroUse()
		.parsePseudoOp()
		.parseOpcode();
	if (!par.isDone()) {
		par.addDiagnosticForTokenRange(
			'Syntax error', DiagnosticSeverity.Error,
			par.lex.tokens[0], par.lex.tokens[0]);
	}
	return {
		diagnostics: par.diagnostics,
		symbolDefinitions: par.symbolDefinitions,
		symbolUses: par.symbolUses,
		symbolUsesByLine: par.symbolUsesByLine,
		macroDefinitions: par.macroDefinitions,
		macroUses: par.macroUses,
		macroUsesByLine: par.macroUsesByLine
	};
}

export function parseBsa(bodyText: string): ParserResult {
	let lineNum = 0;
	const results: ParserResult = bodyText.split('\n')
		.map((line) => parseLine(line, lineNum++))
		.reduce(mergeParserResultsLeft);
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
