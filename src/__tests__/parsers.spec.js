import {
  parseValidNumber,
  parseValidJsonObject,
  parseBooleanTreatment,
} from '../lib/parsers';
import { ParseError } from '@openfeature/web-sdk';

describe('parsers', () => {
  describe('parseValidNumber', () => {
    test('parses integer string', () => {
      expect(parseValidNumber('42')).toBe(42);
    });

    test('parses float string', () => {
      expect(parseValidNumber('3.14')).toBe(3.14);
    });

    test('parses zero', () => {
      expect(parseValidNumber('0')).toBe(0);
    });

    test('parses negative number', () => {
      expect(parseValidNumber('-10')).toBe(-10);
    });

    test('throws ParseError for undefined', () => {
      expect(() => parseValidNumber(undefined)).toThrow(ParseError);
      expect(() => parseValidNumber(undefined)).toThrow(/undefined/);
    });

    test('throws ParseError for non-numeric string', () => {
      expect(() => parseValidNumber('not-a-number')).toThrow(ParseError);
      expect(() => parseValidNumber('not-a-number')).toThrow(/Invalid numeric value/);
    });

    test('throws ParseError for empty string', () => {
      expect(() => parseValidNumber('')).toThrow(ParseError);
    });
  });

  describe('parseValidJsonObject', () => {
    test('parses plain object', () => {
      expect(parseValidJsonObject('{"a":1}')).toEqual({ a: 1 });
    });

    test('parses nested object', () => {
      expect(parseValidJsonObject('{"key":"value","nested":{"inner":"data"}}')).toEqual({
        key: 'value',
        nested: { inner: 'data' },
      });
    });

    test('parses array (object type)', () => {
      expect(parseValidJsonObject('[1,2,3]')).toEqual([1, 2, 3]);
    });

    test('throws ParseError for undefined', () => {
      expect(() => parseValidJsonObject(undefined)).toThrow(ParseError);
      expect(() => parseValidJsonObject(undefined)).toThrow(/undefined/);
    });

    test('throws ParseError for non-object JSON (string)', () => {
      expect(() => parseValidJsonObject('"hello"')).toThrow(ParseError);
      expect(() => parseValidJsonObject('"hello"')).toThrow(/expected "object"/);
    });

    test('throws ParseError for non-object JSON (number)', () => {
      expect(() => parseValidJsonObject('42')).toThrow(ParseError);
    });

    test('throws ParseError for invalid JSON', () => {
      expect(() => parseValidJsonObject('{ invalid }')).toThrow(ParseError);
      expect(() => parseValidJsonObject('{ invalid }')).toThrow(/Error parsing/);
    });
  });

  describe('parseBooleanTreatment', () => {
    test('returns true for "on"', () => {
      expect(parseBooleanTreatment('on')).toBe(true);
    });

    test('returns true for "ON" (case insensitive)', () => {
      expect(parseBooleanTreatment('ON')).toBe(true);
    });

    test('returns true for "true"', () => {
      expect(parseBooleanTreatment('true')).toBe(true);
    });

    test('returns true for "TRUE"', () => {
      expect(parseBooleanTreatment('TRUE')).toBe(true);
    });

    test('returns false for "off"', () => {
      expect(parseBooleanTreatment('off')).toBe(false);
    });

    test('returns false for "OFF"', () => {
      expect(parseBooleanTreatment('OFF')).toBe(false);
    });

    test('returns false for "false"', () => {
      expect(parseBooleanTreatment('false')).toBe(false);
    });

    test('throws ParseError for invalid treatment', () => {
      expect(() => parseBooleanTreatment('maybe')).toThrow(ParseError);
      expect(() => parseBooleanTreatment('maybe')).toThrow(/Invalid boolean value for maybe/);
    });

    test('throws ParseError for unknown string', () => {
      expect(() => parseBooleanTreatment('v1')).toThrow(ParseError);
    });
  });
});
