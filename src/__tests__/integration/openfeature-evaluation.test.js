/**
 * OpenFeature evaluation tests: validate the Split provider through the
 * OpenFeature Web SDK Evaluation API (get*Value, get*Details) and provider lifecycle.
 */
import { OpenFeature, ProviderEvents, StandardResolutionReasons } from '@openfeature/web-sdk';
import { OpenFeatureSplitProvider } from '../../lib/js-split-provider';

describe('OpenFeature evaluation – Split provider', () => {
  let mockSplitClient;
  let provider;
  let client;

  beforeAll(() => {
    mockSplitClient = {
      __getStatus: () => ({ isReady: true, isReadyFromCache: false, hasTimedout: false }),
      on: jest.fn((event, callback) => {
        if (event === 'SDK_READY') setTimeout(() => callback(), 0);
        return { id: 'mock-listener' };
      }),
      Event: {
        SDK_READY: 'SDK_READY',
        SDK_READY_FROM_CACHE: 'SDK_READY_FROM_CACHE',
        SDK_READY_TIMED_OUT: 'SDK_READY_TIMED_OUT',
        SDK_UPDATE: 'SDK_UPDATE',
      },
      getTreatmentWithConfig: jest.fn((flagKey) => {
        if (flagKey === 'bool_on') return { treatment: 'on', config: '{}' };
        if (flagKey === 'bool_off') return { treatment: 'off', config: '' };
        if (flagKey === 'str_flag') return { treatment: 'v1', config: '{"x":1}' };
        if (flagKey === 'num_flag') return { treatment: '99', config: '{}' };
        if (flagKey === 'obj_flag') return { treatment: '{"a":1}', config: '' };
        return { treatment: 'control', config: '' };
      }),
      track: jest.fn(),
      destroy: jest.fn(() => Promise.resolve()),
    };

    const factory = {
      client: () => mockSplitClient,
      destroy: jest.fn(() => Promise.resolve()),
    };
    provider = new OpenFeatureSplitProvider(factory);
  });

  beforeEach(async () => {
    await OpenFeature.setProviderAndWait(provider);
    client = OpenFeature.getClient('evaluation-test');
  });

  afterEach(async () => {
    await OpenFeature.clearProviders();
    await OpenFeature.clearHandlers();
    await OpenFeature.close();
  });

  describe('Provider metadata', () => {
    test('provider has required metadata.name', () => {
      expect(provider.metadata).toBeDefined();
      expect(provider.metadata.name).toBe('split');
    });
  });

  describe('Evaluation API – boolean', () => {
    test('getBooleanValue returns true for on', async () => {
      const value = await client.getBooleanValue('bool_on', false);
      expect(value).toBe(true);
    });

    test('getBooleanValue returns false for off', async () => {
      const value = await client.getBooleanValue('bool_off', true);
      expect(value).toBe(false);
    });

    test('getBooleanDetails returns correct ResolutionDetails shape', async () => {
      const details = await client.getBooleanDetails('bool_on', false);
      expect(details.value).toBe(true);
      expect(details.flagKey).toBe('bool_on');
      expect(details.variant).toBe('on');
      expect(details.reason).toBe(StandardResolutionReasons.TARGETING_MATCH);
      expect(details.flagMetadata).toBeDefined();
      expect(details.flagMetadata.config).toBeDefined();
    });
  });

  describe('Evaluation API – string', () => {
    test('getStringValue returns treatment as string', async () => {
      const value = await client.getStringValue('str_flag', 'default');
      expect(value).toBe('v1');
    });

    test('getStringDetails returns correct ResolutionDetails shape', async () => {
      const details = await client.getStringDetails('str_flag', 'default');
      expect(details.value).toBe('v1');
      expect(details.flagKey).toBe('str_flag');
      expect(details.variant).toBe('v1');
      expect(details.reason).toBe(StandardResolutionReasons.TARGETING_MATCH);
      expect(details.flagMetadata.config).toBe('{"x":1}');
    });
  });

  describe('Evaluation API – number', () => {
    test('getNumberValue returns parsed number', async () => {
      const value = await client.getNumberValue('num_flag', 0);
      expect(value).toBe(99);
    });

    test('getNumberDetails returns correct ResolutionDetails shape', async () => {
      const details = await client.getNumberDetails('num_flag', 0);
      expect(details.value).toBe(99);
      expect(details.flagKey).toBe('num_flag');
      expect(details.variant).toBe('99');
      expect(details.reason).toBe(StandardResolutionReasons.TARGETING_MATCH);
    });
  });

  describe('Evaluation API – object', () => {
    test('getObjectValue returns parsed JSON object', async () => {
      const value = await client.getObjectValue('obj_flag', {});
      expect(value).toEqual({ a: 1 });
    });

    test('getObjectDetails returns correct ResolutionDetails shape', async () => {
      const details = await client.getObjectDetails('obj_flag', {});
      expect(details.value).toEqual({ a: 1 });
      expect(details.flagKey).toBe('obj_flag');
      expect(details.reason).toBe(StandardResolutionReasons.TARGETING_MATCH);
    });
  });

  describe('Context and targeting', () => {
    test('getTreatmentWithConfig is called with context attributes', async () => {
      await client.getBooleanValue('bool_on', false);
      expect(mockSplitClient.getTreatmentWithConfig).toHaveBeenCalledWith('bool_on', {});
    });

    test('context attributes are passed to Split', async () => {
      await OpenFeature.setContext({ targetingKey: 'user-1', region: 'eu' });
      await client.getBooleanValue('bool_on', false);
      expect(mockSplitClient.getTreatmentWithConfig).toHaveBeenCalledWith('bool_on', { region: 'eu' });
    });
  });

  describe('Control / flag not found', () => {
    test('control treatment: client returns default value', async () => {
      const value = await client.getStringValue('unknown_flag', 'default');
      expect(value).toBe('default');
    });
    test('control treatment: getStringDetails reveals FLAG_NOT_FOUND', async () => {
      const details = await client.getStringDetails('unknown_flag', 'default');
      expect(details.value).toBe('default');
      expect(details.reason).toBe(StandardResolutionReasons.ERROR);
    });
  });

  describe('Provider events', () => {
    test('provider exposes events emitter', () => {
      expect(provider.events).toBeDefined();
      expect(typeof provider.events.emit).toBe('function');
      expect(typeof provider.events.addHandler).toBe('function');
    });
  });
});
