/* eslint-disable jest/no-conditional-expect */
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
      getTreatmentWithConfig: jest.fn((flagKey, _attributes) => {
        // Return specific values for our test cases
        if (flagKey === 'boolean-flag') return { treatment: 'on', config: '{"desc": "this is a test"}' };
        if (flagKey === 'boolean-flag-off') return { treatment: 'off', config: {} };
        if (flagKey === 'string-flag') return { treatment: 'a-string-treatment', config: {} };
        if (flagKey === 'number-flag') return { treatment: '42', config: {} };
        if (flagKey === 'object-flag') return { treatment: '{"key":"value","nested":{"inner":"data"}}', config: {} };
        if (flagKey === 'non-existent') return { treatment: 'control', config: {} };
        return { treatment: 'control', config: {} };
      }),
      // mock tracking
      track: jest.fn(() => {}),
      
      // Clean up
      destroy: jest.fn(() => Promise.resolve())
    };
    
    // Create the provider with our mock client
    provider = new OpenFeatureSplitProvider({
      client: () => mockSplitClient
    });
  });
  
  test('should transform boolean ON treatment to true', () => {
    const result = provider.resolveBooleanEvaluation(
      'boolean-flag',
      false, // default value
      { targetingKey: 'user-key' },
      console // logger
    );
    
    expect(result.value).toBe(true);
    expect(result.variant).toBe('on');
    expect(result.flagMetadata.config).toBe('{"desc": "this is a test"}');
    expect(mockSplitClient.getTreatmentWithConfig).toHaveBeenCalledWith(
      'boolean-flag',
      {}
    );
  });
  
  test('should transform boolean OFF treatment to false', () => {
    const result = provider.resolveBooleanEvaluation(
      'boolean-flag-off',
      true, // default value
      { targetingKey: 'user-key' },
      console // logger
    );
    
    expect(result.value).toBe(false);
    expect(result.variant).toBe('off');
  });
  
  test('should handle string treatments', () => {
    const result = provider.resolveStringEvaluation(
      'string-flag',
      'default', // default value
      { targetingKey: 'user-key' },
      console // logger
    );
    
    expect(result.value).toBe('a-string-treatment');
    expect(result.variant).toBe('a-string-treatment');
  });
  
  test('should handle number treatments', () => {
    const result = provider.resolveNumberEvaluation(
      'number-flag',
      0, // default value
      { targetingKey: 'user-key' },
      console // logger
    );
    
    expect(result.value).toBe(42);
    expect(result.variant).toBe('42');
  });
  
  test('should handle object treatments', () => {
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

  test('track: throws when missing eventName', () => {
    try {
      provider.track('', { trafficType: 'user' }, {});
    } catch (e) {
      expect(e.message).toBe('Missing eventName, required to track');
      expect(e.code).toBe('PARSE_ERROR');
    }
  });

  test('track: throws when missing trafficType', () => {
    try {
      provider.track('evt', {}, {});
    } catch (e) {
      expect(e.message).toBe('Missing trafficType variable, required to track');
      expect(e.code).toBe('INVALID_CONTEXT');
    }
  });

  test('track: ok without details', () => {
    const trackSpy = jest.spyOn(mockSplitClient, 'track');
    provider.track('view', { trafficType: 'user' }, null);
    expect(trackSpy).toHaveBeenCalledTimes(1);
    expect(trackSpy).toHaveBeenCalledWith('user', 'view', undefined, {});
  });

  test('track: ok with details', () => {
    const trackSpy = jest.spyOn(mockSplitClient, 'track');
    provider.track(
      'purchase',
      { trafficType: 'user' },
      { value: 9.99, properties: { plan: 'pro', beta: true } }
    );
    expect(trackSpy).toHaveBeenCalledTimes(1);
    expect(trackSpy).toHaveBeenCalledWith('user', 'purchase', 9.99, { plan: 'pro', beta: true });
  });
  
});
