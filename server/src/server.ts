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
			// definitionProvider: true,
			// referencesProvider: true,
			// documentSymbolProvider: true,
			// documentHighlightProvider: true,
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

// TODO: Go To Definition
connection.onDefinition((request: DefinitionParams) => {
	// request.textDocument.uri
	// request.position.character
	// request.position.line

	// return null;
	return {
		uri: request.textDocument.uri,
		range: {
			start: { line: 0, character: 0 },
			end: { line: 0, character: 1 }
		}
	};
});

// TODO: Find All References
connection.onReferences((request: ReferenceParams) => {
	// request.textDocument.uri
	// request.position.character
	// request.position.line
	// request.context.includeDeclaration

	// return null;
	return [
		{
			uri: request.textDocument.uri,
			range: {
				start: { line: 0, character: 0 },
				end: { line: 0, character: 1 }
			}
		}
	];
});

// TODO: List Document Symbols
connection.onDocumentSymbol((request: DocumentSymbolParams) => {
	// request.textDocument.uri
	return [
		{
			name: 'symName',
			kind: SymbolKind.Variable,
			range: {
				start: { line: 0, character: 0 },
				end: { line: 0, character: 1 }
			},
			selectionRange: {
				start: { line: 0, character: 0 },
				end: { line: 0, character: 1 }
			}
		}
	];
});

// TODO: Highlight All Occurrences
connection.onDocumentHighlight((request: DocumentHighlightParams) => {
	// request.textDocument.uri
	// request.position.character
	// request.position.line

	return [
		{
			range: {
				start: { line: 0, character: 0 },
				end: { line: 0, character: 1 }
			}
		}
	];
});

documents.listen(connection);

connection.listen();
