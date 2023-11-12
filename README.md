# BSA 6502 / 45GS02 assembler extension for VSCode

This is a VSCode extension for the [BSA
assembler](https://github.com/Edilbert/BSA). The extension is primarily
intended for use by the [MEGA65](https://mega65.org/) project.

## Features

Implemented features:

* Syntax highlighting

Intended features:

* Jump to definition
* Hover display of assembler-generated addresses and values
* Error checking
* Folding

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

## Requirements

TODO

Acquire and build the [BSA assembler](https://github.com/Edilbert/BSA). Set the
`bsaPath` configuration property.

## Extension Settings

TODO

* `bsaPath`

## Known Issues

This extension is a work in progress and is not yet released.

## Release Notes

* 0.0.0: Not yet released.
