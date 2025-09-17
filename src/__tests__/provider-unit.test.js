/* eslint-disable @typescript-eslint/no-unused-vars */
import { OpenFeatureSplitProvider } from '../lib/js-split-provider';

describe('OpenFeatureSplitProvider Unit Tests', () => {
  let provider;
  let mockSplitClient;
  
  beforeEach(() => {
    // Create a properly mocked Split client specifically for the provider
    mockSplitClient = {
      // Add ready method needed by provider
      ready: jest.fn(() => true),
      __getStatus: () => ({isReady: true}),
      
      // Add event support
      on: jest.fn((event, callback) => {
        if (event === 'SDK_READY') {
          // Immediately call the callback
          setTimeout(() => callback(), 0);
        }
        return { id: 'mock-listener' };
      }),
      // Define SDK_READY event constant
      Event: { SDK_READY: 'SDK_READY' },
      
      // Mock the treatments
      getTreatment: jest.fn((flagKey, _attributes) => {
        // Return specific values for our test cases
        if (flagKey === 'boolean-flag') return 'on';
        if (flagKey === 'boolean-flag-off') return 'off';
        if (flagKey === 'string-flag') return 'a-string-treatment';
        if (flagKey === 'number-flag') return '42';
        if (flagKey === 'object-flag') return '{"key":"value","nested":{"inner":"data"}}';
        if (flagKey === 'non-existent') return 'control';
        return 'control';
      }),
      
      // Clean up
      destroy: jest.fn(() => Promise.resolve())
    };
    
    // Create the provider with our mock client
    provider = new OpenFeatureSplitProvider({
      client: () => mockSplitClient
    });
  });
  
  test('should transform boolean ON treatment to true', async () => {
    const result = provider.resolveBooleanEvaluation(
      'boolean-flag',
      false, // default value
      { targetingKey: 'user-key' },
      console // logger
    );
    
    expect(result.value).toBe(true);
    expect(result.variant).toBe('on');
    expect(mockSplitClient.getTreatment).toHaveBeenCalledWith(
      'boolean-flag',
      {}
    );
  });
  
  test('should transform boolean OFF treatment to false', async () => {
    const result = provider.resolveBooleanEvaluation(
      'boolean-flag-off',
      true, // default value
      { targetingKey: 'user-key' },
      console // logger
    );
    
    expect(result.value).toBe(false);
    expect(result.variant).toBe('off');
  });
  
  test('should handle string treatments', async () => {
    const result = provider.resolveStringEvaluation(
      'string-flag',
      'default', // default value
      { targetingKey: 'user-key' },
      console // logger
    );
    
    expect(result.value).toBe('a-string-treatment');
    expect(result.variant).toBe('a-string-treatment');
  });
  
  test('should handle number treatments', async () => {
    const result = provider.resolveNumberEvaluation(
      'number-flag',
      0, // default value
      { targetingKey: 'user-key' },
      console // logger
    );
    
    expect(result.value).toBe(42);
    expect(result.variant).toBe('42');
  });
  
  test('should handle object treatments', async () => {
    const result = provider.resolveObjectEvaluation(
      'object-flag',
      {}, // default value
      { targetingKey: 'user-key' },
      console // logger
    );
    
    expect(result.value).toEqual({ key: 'value', nested: { inner: 'data' } });
    expect(result.variant).toBe('{"key":"value","nested":{"inner":"data"}}');
  });
  
  test('should handle control treatment as error', () => {
    expect(() => {
      provider.resolveStringEvaluation(
        'non-existent',
        'default', // default value
        { targetingKey: 'user-key' },
        console // logger
      );
    }).toThrow(/control/);
  });
  
  test('should throw error when targeting key is missing', () => {
    expect(() => {
      provider.resolveStringEvaluation(
        'string-flag',
        'default', // default value
        {}, // no targeting key
        console // logger
      );
    }).toThrow(/targeting key/i);
  });
  
  test('should include metadata in evaluation result', () => {
    const result = provider.resolveStringEvaluation(
      'string-flag',
      'default', // default value
      { targetingKey: 'user-key' },
      console // logger
    );
    
    expect(result.flagKey).toBe('string-flag');
    expect(result.reason).toBe('TARGETING_MATCH');
  });
});
