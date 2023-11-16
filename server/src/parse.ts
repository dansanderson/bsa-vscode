import {
	Diagnostic,
} from 'vscode-languageserver/node';

export interface ParseResults {
	diagnostics: Diagnostic[];
}

export function mergeResults(first: ParseResults, second: ParseResults): ParseResults {
	return {
		diagnostics: first.diagnostics.concat(second.diagnostics)
	};
}
