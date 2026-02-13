/* eslint-disable @typescript-eslint/no-unused-vars */
import { transformContext } from '../lib/context';

describe('context', () => {
  describe('transformContext', () => {
    const defaultTrafficType = 'user';

    test('uses defaultTrafficType when context has no trafficType', () => {
      const result = transformContext({ targetingKey: 'key-1' }, defaultTrafficType);
      expect(result.trafficType).toBe('user');
      expect(result.targetingKey).toBe('key-1');
      expect(result.attributes).toEqual({});
    });

    test('uses context trafficType when present and non-empty', () => {
      const result = transformContext(
        { targetingKey: 'key-1', trafficType: 'account' },
        defaultTrafficType
      );
      expect(result.trafficType).toBe('account');
      expect(result.targetingKey).toBe('key-1');
      expect(result.attributes).toEqual({});
    });

    test('falls back to default when trafficType is empty string', () => {
      const result = transformContext(
        { targetingKey: 'key-1', trafficType: '' },
        defaultTrafficType
      );
      expect(result.trafficType).toBe('user');
    });

    test('falls back to default when trafficType is whitespace', () => {
      const result = transformContext(
        { targetingKey: 'key-1', trafficType: '   ' },
        defaultTrafficType
      );
      expect(result.trafficType).toBe('user');
    });

    test('passes remaining context as attributes', () => {
      const result = transformContext(
        {
          targetingKey: 'key-1',
          trafficType: 'user',
          region: 'eu',
          plan: 'pro',
        },
        defaultTrafficType
      );
      expect(result.attributes).toEqual({ region: 'eu', plan: 'pro' });
    });

    test('deep-clones attributes (no reference)', () => {
      const attrs = { nested: { value: 1 } };
      const result = transformContext(
        { targetingKey: 'k', ...attrs },
        defaultTrafficType
      );
      expect(result.attributes).toEqual({ nested: { value: 1 } });
      expect(result.attributes).not.toBe(attrs);
      expect(result.attributes.nested).not.toBe(attrs.nested);
    });
  });
});
