import { expect } from '@jest/globals';

import { parseLine, parseBsa } from '../src/bsa_parse';

describe('parseLine: empty and comments', () => {
	test('empty string returns empty results', () => {
		const results = parseLine('', 0);
		expect(results.diagnostics.length).toBe(0);
	});

	test('star comment only returns empty results', () => {
		const results = parseLine('  * star comment', 0);
		expect(results.diagnostics.length).toBe(0);
	});

	test('semicolon comment only returns empty results', () => {
		const results = parseLine('   ; line comment', 0);
		expect(results.diagnostics.length).toBe(0);
	});
});

// describe('parseLine: conditional assembly', () => {
// 	test('#ifdef with symbol ok', () => {
// 		let results;
// 		results = parseLine('   #ifdef foo', 0);
// 		expect(results.diagnostics.length).toBe(0);
// 		results = parseLine('#ifdef SYMBOL_NAME    ; with a line comment', 0);
// 		expect(results.diagnostics.length).toBe(0);
// 	});
// 	test('#ifdef missing symbol', () => {
// 		let results;
// 		results = parseLine('#ifdef', 0);
// 		expect(results.diagnostics.length).toBe(1);
// 		expect(results.diagnostics[0].message).toEqual(
// 			'Missing symbol for #ifdef');
// 		expect(results.diagnostics[0].range.start.character).toBe(0);
// 		expect(results.diagnostics[0].range.end.character).toBe(6);

// 		results = parseLine('#ifdef   ; comment', 0);
// 		expect(results.diagnostics.length).toBe(1);
// 		expect(results.diagnostics[0].message).toEqual(
// 			'Missing symbol for #ifdef');
// 		expect(results.diagnostics[0].range.start.character).toBe(0);
// 		expect(results.diagnostics[0].range.end.character).toBe(6);
// 	});
// 	test('#ifdef unexpected characters', () => {
// 		const results = parseLine('#ifdef SYMBOL_NAME other  ; comment', 0);
// 		expect(results.diagnostics.length).toBe(1);
// 		expect(results.diagnostics[0].message).toEqual(
// 			'Unexpected characters after #ifdef');
// 		expect(results.diagnostics[0].range.start.character).toBe(18);
// 		expect(results.diagnostics[0].range.end.character).toBe(18);
// 	});

// 	test('#else ok', () => {
// 		let results;
// 		results = parseLine('   #else', 0);
// 		expect(results.diagnostics.length).toBe(0);
// 		results = parseLine('#else    ; with a line comment', 0);
// 		expect(results.diagnostics.length).toBe(0);
// 	});
// 	test('#else error', () => {
// 		const results = parseLine('#else err', 0);
// 		expect(results.diagnostics.length).toBe(1);
// 		expect(results.diagnostics[0].message).toEqual(
// 			'#else must appear alone on the line');
// 		expect(results.diagnostics[0].range.start.character).toBe(0);
// 		expect(results.diagnostics[0].range.end.character).toBe(5);
// 	});

// 	test('#endif ok', () => {
// 		let results;
// 		results = parseLine('   #endif', 0);
// 		expect(results.diagnostics.length).toBe(0);
// 		results = parseLine('#endif    ; with a line comment', 0);
// 		expect(results.diagnostics.length).toBe(0);
// 	});
// 	test('#endif error', () => {
// 		const results = parseLine('#endif err', 0);
// 		expect(results.diagnostics.length).toBe(1);
// 		expect(results.diagnostics[0].message).toEqual(
// 			'#endif must appear alone on the line');
// 		expect(results.diagnostics[0].range.start.character).toBe(0);
// 		expect(results.diagnostics[0].range.end.character).toBe(6);
// 	});

// 	test('#error ok', () => {
// 		for (const s of [
// 			'#error some text',
// 			'   #error         ; comment',
// 			'#error'
// 		]) {
// 			const results = parseLine(s, 0);
// 			expect(results.diagnostics.length).toBe(0);
// 		}
// 	});

// 	test('Unrecognized conditional directive', () => {
// 		const results = parseLine('#unrecognized', 0);
// 		expect(results.diagnostics.length).toBe(1);
// 		expect(results.diagnostics[0].message).toEqual(
// 			'Unrecognized assembler directive');
// 		expect(results.diagnostics[0].range.start.character).toBe(0);
// 		expect(results.diagnostics[0].range.end.character).toBe(1);
// 	});
// });

// describe('parseLine: macros', () => {
// 	test('endmac ok', () => {
// 		let results;
// 		results = parseLine('    endmac', 0);
// 		expect(results.diagnostics.length).toBe(0);
// 		results = parseLine('endmac    ; with a line comment', 0);
// 		expect(results.diagnostics.length).toBe(0);
// 	});
// 	test('endmac error', () => {
// 		const results = parseLine('    endmac err', 0);
// 		expect(results.diagnostics.length).toBe(1);
// 		expect(results.diagnostics[0].message).toEqual(
// 			'endmac must appear alone on the line');
// 		expect(results.diagnostics[0].range.start.character).toBe(4);
// 		expect(results.diagnostics[0].range.end.character).toBe(10);
// 	});
// });

describe('parseBsa', () => {
	test('empty string returns empty results', () => {
		const results = parseBsa('');
		expect(results.diagnostics.length).toBe(0);
	});
});
