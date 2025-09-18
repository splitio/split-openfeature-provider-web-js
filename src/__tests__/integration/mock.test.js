/* eslint-disable jest/no-conditional-expect */
import { OpenFeature } from '@openfeature/web-sdk';
import { OpenFeatureSplitProvider } from '../../lib/js-split-provider';

describe('OpenFeature Split Provider - Mock Integration Tests', () => {
  let client;
  let mockSplitClient;
  let provider;

  beforeEach(() => {
    // Create a fully mocked Split client that returns predictable values
    mockSplitClient = {
      // Mock Split client methods
      ready: jest.fn(() => true),
      on: jest.fn((event, callback) => {
        if (event === 'SDK_READY') {
          // Immediately call the callback to simulate ready state
          callback();
        }
        return { id: 'mock-listener' };
      }),
      Event: { SDK_READY: 'SDK_READY' },
      __getStatus: () => ({isReady: true}),
      
      // Mock treatment evaluation methods
      getTreatmentWithConfig: jest.fn((splitName) => {
        if (splitName === 'my_feature') return { treatment: 'on', config: '{"desc": "this is a test"}' };
        if (splitName === 'some_other_feature') return { treatment: 'off' };
        if (splitName === 'int_feature') return { treatment: '32' };
        if (splitName === 'obj_feature') return { treatment: '{"key": "value"}' };
        return { treatment: 'control' };
      }),
      
      // Mock for cleanup
      destroy: jest.fn(() => Promise.resolve())
    };

    // Create the provider with our mock Split client
    provider = new OpenFeatureSplitProvider({ client: () => mockSplitClient});

    // Register with OpenFeature
    OpenFeature.setProviderAndWait(provider);
    OpenFeature.setContext({ targetingKey: 'user1' })

    // Get the client
    client = OpenFeature.getClient('mock-test');
  });

  afterEach(async () => {
    await mockSplitClient.destroy();
  });

  test('boolean evaluation should work', async () => {
    const result = await client.getBooleanValue('my_feature', false);
    expect(result).toBe(true);
    expect(mockSplitClient.getTreatmentWithConfig).toHaveBeenCalledWith('my_feature', {});
  });

  test('boolean evaluation should handle off value', async () => {
    const result = await client.getBooleanValue('some_other_feature', true);
    expect(result).toBe(false);
  });

  test('string evaluation should work', async () => {
    const result = await client.getStringValue('some_other_feature', 'default');
    expect(result).toBe('off');
  });

  test('number evaluation should work', async () => {
    const result = await client.getNumberValue('int_feature', 0);
    expect(result).toBe(32);
  });

  test('object evaluation should work', async () => {
    const result = await client.getObjectValue('obj_feature', {});
    expect(result).toEqual({ key: 'value' });
  });

  test('boolean details should include metadata', async () => {
    const details = await client.getBooleanDetails('my_feature', false);
    expect(details.value).toBe(true);
    expect(details.variant).toBe('on');
    expect(details.flagKey).toBe('my_feature');
    expect(details.flagMetadata.config).toBe('{"desc": "this is a test"}')
    expect(details.reason).toBe('TARGETING_MATCH');
  });

  test('control treatment should be handled correctly', async () => {
    try {
      provider.resolveBooleanEvaluation('non_existent_feature', false, { targetingKey: 'user_1' });
    } catch (error) {
      expect(error.name).toBe('FlagNotFoundError');
      expect(error.message).toContain('control');
    }
  });
});
