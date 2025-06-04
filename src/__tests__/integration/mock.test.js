import { OpenFeature } from '@openfeature/web-sdk';
import { OpenFeatureSplitProvider } from '../../lib/js-split-provider';

describe('OpenFeature Split Provider - Mock Integration Tests', () => {
  let client;
  let mockSplitClient;

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
      
      // Mock treatment evaluation methods
      getTreatment: jest.fn((key, splitName) => {
        if (splitName === 'my_feature') return 'on';
        if (splitName === 'some_other_feature') return 'off';
        if (splitName === 'int_feature') return '32';
        if (splitName === 'obj_feature') return '{"key": "value"}';
        return 'control';
      }),
      
      // Mock for cleanup
      destroy: jest.fn(() => Promise.resolve())
    };

    // Create the provider with our mock Split client
    const provider = new OpenFeatureSplitProvider({
      splitClient: mockSplitClient
    });

    // Register with OpenFeature
    OpenFeature.setProvider(provider);
    
    // Get the client
    client = OpenFeature.getClient('mock-test');
  });

  afterEach(async () => {
    await mockSplitClient.destroy();
  });

  test('boolean evaluation should work', async () => {
    const result = await client.getBooleanValue('my_feature', false, { targetingKey: 'user1' });
    expect(result).toBe(true);
    expect(mockSplitClient.getTreatment).toHaveBeenCalledWith('user1', 'my_feature', {});
  });

  test('boolean evaluation should handle off value', async () => {
    const result = await client.getBooleanValue('some_other_feature', true, { targetingKey: 'user1' });
    expect(result).toBe(false);
  });

  test('string evaluation should work', async () => {
    const result = await client.getStringValue('some_other_feature', 'default', { targetingKey: 'user1' });
    expect(result).toBe('off');
  });

  test('number evaluation should work', async () => {
    const result = await client.getNumberValue('int_feature', 0, { targetingKey: 'user1' });
    expect(result).toBe(32);
  });

  test('object evaluation should work', async () => {
    const result = await client.getObjectValue('obj_feature', {}, { targetingKey: 'user1' });
    expect(result).toEqual({ key: 'value' });
  });

  test('boolean details should include metadata', async () => {
    const details = await client.getBooleanDetails('my_feature', false, { targetingKey: 'user1' });
    expect(details.value).toBe(true);
    expect(details.variant).toBe('on');
    expect(details.flagKey).toBe('my_feature');
    expect(details.reason).toBe('TARGETING_MATCH');
  });

  test('missing targeting key should return an error', async () => {
    const details = await client.getBooleanDetails('my_feature', false, {});
    expect(details.value).toBe(false); // Default value
    expect(details.errorCode).toBe('TARGETING_KEY_MISSING');
    expect(details.reason).toBe('ERROR');
  });

  test('control treatment should be handled correctly', async () => {
    mockSplitClient.getTreatment.mockReturnValueOnce('control');
    
    try {
      await client.getBooleanDetails('non_existent_feature', false, { targetingKey: 'user1' });
      fail('Expected error was not thrown');
    } catch (error) {
      expect(error.name).toBe('FlagNotFoundError');
      expect(error.message).toContain('control');
    }
  });
});
