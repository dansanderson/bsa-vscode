import {
	createConnection,
	TextDocuments,
	ProposedFeatures,
	InitializeParams,
	TextDocumentSyncKind,
	InitializeResult,
	DefinitionParams,
	ReferenceParams,
	DocumentSymbolParams,
	SymbolKind,
	DocumentHighlightParams
} from 'vscode-languageserver/node';

import {
	TextDocument
} from 'vscode-languageserver-textdocument';

import { Token } from './bsa_lex';

import {
	ParserResult,
	parseBsa
} from './bsa_parse';

const connection = createConnection(ProposedFeatures.all);

const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let hasDiagnosticRelatedInformationCapability = false;

const documentParseResults: Map<string, ParserResult> = new Map();

connection.onInitialize((params: InitializeParams) => {

	const capabilities = params.capabilities;

	// Does the client support the `workspace/configuration` request?
	// If not, we fall back using global settings.
	hasConfigurationCapability = !!(
		capabilities.workspace && !!capabilities.workspace.configuration
	);
	hasWorkspaceFolderCapability = !!(
		capabilities.workspace && !!capabilities.workspace.workspaceFolders
	);
	hasDiagnosticRelatedInformationCapability = !!(
		capabilities.textDocument &&
		capabilities.textDocument.publishDiagnostics &&
		capabilities.textDocument.publishDiagnostics.relatedInformation
	);

	const result: InitializeResult = {
		capabilities: {
			textDocumentSync: TextDocumentSyncKind.Incremental,
			definitionProvider: true,
			referencesProvider: true,
			documentSymbolProvider: true,
			documentHighlightProvider: true,
		}
	};
	if (hasWorkspaceFolderCapability) {
		result.capabilities.workspace = {
			workspaceFolders: {
				supported: true
			}
		};
	}
	return result;
});

connection.onInitialized(() => {
	if (hasWorkspaceFolderCapability) {
		connection.workspace.onDidChangeWorkspaceFolders(_event => {
			connection.console.log('Workspace folder change event received.');
		});
	}
});

documents.onDidClose(e => {
	documentParseResults.delete(e.document.uri);
});

documents.onDidChangeContent(change => {
	validateTextDocument(change.document);
});

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
	const parseResults: ParserResult = parseBsa(textDocument.getText());

	documentParseResults.set(textDocument.uri, parseResults);

	connection.sendDiagnostics({
		uri: textDocument.uri,
		diagnostics: parseResults.diagnostics
	});
}

function findUseTokenByPosition(
		usesByLine: Map<number, Array<Token>>,
		definitions: Token[],
		lineNumber: number,
		charPos: number): Token | undefined {
	const usesForLine = usesByLine.get(lineNumber);
	if (!usesForLine) return undefined;
	return usesForLine.find(useToken => charPos >= useToken.start && charPos <= useToken.end);
}

function findDefinitionForUse(
		usesByLine: Map<number, Array<Token>>,
		definitions: Token[],
		lineNumber: number,
		charPos: number): Token | undefined {
	const useToken = findUseTokenByPosition(usesByLine, definitions, lineNumber, charPos);
	if (!useToken) return undefined;
	return definitions.find(defToken => defToken.normText === useToken.normText);
}

connection.onDefinition((request: DefinitionParams) => {
	const parseResult = documentParseResults.get(request.textDocument.uri);
	if (!parseResult) return null;

	const defToken: Token | undefined = (
		findDefinitionForUse(
			parseResult.symbolUsesByLine,
			parseResult.symbolDefinitions,
			request.position.line,
			request.position.character) ||
		findDefinitionForUse(
			parseResult.macroUsesByLine,
			parseResult.macroDefinitions,
			request.position.line,
			request.position.character));

	if (defToken) {
		return {
			uri: request.textDocument.uri,
			range: {
				start: { line: defToken.lineNumber, character: defToken.start },
				end: { line: defToken.lineNumber, character: defToken.end }
			}
		};
	}
	return null;
});

function findReferencesForUse(
		usesByName: Map<string, Array<Token>>,
		usesByLine: Map<number, Array<Token>>,
		definitions: Token[],
		lineNumber: number,
		charPos: number): Array<Token> {
	const useToken = findUseTokenByPosition(usesByLine, definitions, lineNumber, charPos);
	if (!useToken || !useToken.normText) return [];
	return usesByName.get(useToken.normText || '') || [];
}

connection.onReferences((request: ReferenceParams) => {
	// (BSA references only apply to the current file.)
	const parseResult = documentParseResults.get(request.textDocument.uri);
	if (!parseResult) return null;

	const references: Array<Token> = (
		findReferencesForUse(
			parseResult.symbolUses,
			parseResult.symbolUsesByLine,
			parseResult.symbolDefinitions,
			request.position.line,
			request.position.character) ||
		findReferencesForUse(
			parseResult.macroUses,
			parseResult.macroUsesByLine,
			parseResult.macroDefinitions,
			request.position.line,
			request.position.character));

	// TODO: request.context.includeDeclaration

	return references.map(tok => {
		return {
			uri: request.textDocument.uri,
			range: {
				start: { line: tok.lineNumber, character: tok.start },
				end: { line: tok.lineNumber, character: tok.end }
			}
		};
	});
});

connection.onDocumentSymbol((request: DocumentSymbolParams) => {
	const parseResult = documentParseResults.get(request.textDocument.uri);
	if (!parseResult) return null;

	return parseResult.symbolDefinitions.concat(parseResult.macroDefinitions).map(defToken => {
		return {
			name: defToken.normText || '',
			kind: SymbolKind.Variable,
			location: {
				uri: request.textDocument.uri,
				range: {
					start: { line: defToken.lineNumber, character: defToken.start },
					end: { line: defToken.lineNumber, character: defToken.end }
				}
			}
		};
	});
});

connection.onDocumentHighlight((request: DocumentHighlightParams) => {
	const parseResult = documentParseResults.get(request.textDocument.uri);
	if (!parseResult) return null;

	const references: Array<Token> = (
		findReferencesForUse(
			parseResult.symbolUses,
			parseResult.symbolUsesByLine,
			parseResult.symbolDefinitions,
			request.position.line,
			request.position.character) ||
		findReferencesForUse(
			parseResult.macroUses,
			parseResult.macroUsesByLine,
			parseResult.macroDefinitions,
			request.position.line,
			request.position.character));

	return references.map(tok => {
		return {
			range: {
				start: { line: tok.lineNumber, character: tok.start },
				end: { line: tok.lineNumber, character: tok.end }
			}
		};
	});
});

documents.listen(connection);

connection.listen();
