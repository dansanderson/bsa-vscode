# BSA 6502 / 45GS02 assembler extension for VS Code

This is a VS Code extension for the [BSA
assembler](https://github.com/MEGA65/BSA). The extension is primarily
intended for use by the [MEGA65](https://mega65.org/) project.

## Features

Implemented features:

* Syntax highlighting
* Highlight errors and warnings
* List and highlight references to a symbol or macro
* Go to definition for a symbol or macro
* List document symbols and macros

Not yet implemented:

* Different syntax coloring for branch instructions
* Parsing of pseudo-op arguments
* Validate addressing modes per instruction, i.e. only allow CPU-valid opcode + addressing mode combinations

## Installing the extension

First, [download the `.vsix` package release](https://github.com/dansanderson/bsa-vscode/releases/). Then install it:

1. Go to the Extensions view.
2. Click the **...** dropdown menu.
3. Select **Install from VSIX...**. Follow the prompts to select the `.vsix` file.

Now you can select the "BSA" file type, either manually for a file or associated with a filename extension. To make this project-specific, edit `.vscode/settings.json` and add a section like this:

```json
	"files.associations": {
		"*.src": "bsa",
		"*.asm": "bsa"
	}
```

To build the `.vsix` package from source, make sure you have run `npm install`, then: `npm run package`

## Customizing syntax coloring

This extension defines syntax coloring scopes, and derives all colors from the current theme. You may wish to customize certain colors.

For example, to set the immediate mode `#` to pink and local labels (`10$`) to cyan, add this to your `settings.json` file:

```json
    "editor.tokenColorCustomizations": {
        "textMateRules": [
            {
                "scope": "keyword.other.opcode-addressing-immediate.bsa",
                "settings": {
                    "foreground": "#da69a2"
                }
            },
            {
                "scope": "entity.name.tag.bsa",
                "settings": {
                    "foreground": "#69c7c0",
                }
            }
        ]
    }
```

For a complete list of scopes, see `./syntaxes/bsa.tmLanguage.json`.

## Developing the extension

### Installing packages

This extension, including the language server, is written entirely in TypeScript. To set up development, it should be sufficient to run `npm install` in the root folder, in `client/`, and in `server/`.

### Starting a debugging session

To start a debugging session:

1. Open the root folder in VS Code.
2. Press **Ctrl + Shift + B** (**Cmd + Shift + B** on Mac) to start compiling the client and server in watch mode.
3. Select the Run and Debug view from the side panel (or press **Ctrl + Shift + D**, **Cmd + Shift + D** on Mac).
4. Select the "Client + Server" compound debugging configuration from the dropdown menu, then press F5 to launch it. The main window starts debugging mode with a debugging toolbar shown, and another window opens running the extension.
5. In the main window's debugging toolbar, switch between "Launch Client" and "Activate Server" to debug the client or server, respectively. This switches the Debug Console, and allows for setting breakpoints on the respective TypeScript code files.

To enable logging of all client-server messages, add this to `.vscode/settings.json`: `"bsa.trace.server": "verbose"`

### Language server unit tests

The language server uses [Jest](https://jestjs.io/) for unit tests, with TypeScript support.

Tests are located in `server/tests/`. Example:

```ts
import { parseBsa } from '../src/bsa';

describe('parseBsa', () => {
	test('empty string returns empty results', () => {
		const results = parseBsa('');
		expect(results.diagnostics.length).toBe(0);
	});
});
```

To run language server unit tests: `cd server; npm run test`

## Release Notes

* 0.0.1: Initial release.
