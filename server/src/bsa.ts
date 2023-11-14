import {
	Diagnostic,
	DiagnosticSeverity
} from 'vscode-languageserver/node';

import { ParseResults } from './parse';

export function parseBsa(s: string): ParseResults {
	return {
		diagnostics: []
	};
}
