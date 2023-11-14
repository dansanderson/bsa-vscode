import {
	Diagnostic,
} from 'vscode-languageserver/node';

export interface ParseResults {
	diagnostics: Diagnostic[];
}
