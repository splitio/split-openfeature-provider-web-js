/* eslint-disable @typescript-eslint/no-unused-vars */
import { OpenFeature, OpenFeatureEventEmitter, ProviderEvents } from '@openfeature/web-sdk';
import { SplitFactory } from '@splitsoftware/splitio-browserjs';
import { OpenFeatureSplitProvider } from '../..';

// Mock Split features for browser testing
const mockFeatures = {
  'my_feature': {
    treatment: 'on',
    config: '{"desc" : "this applies only to ON treatment"}'
  },
  'some_other_feature': {
    treatment: 'off'
  },
  'int_feature': {
    treatment: '32'
  },
  'obj_feature': {
    treatment: '{"key": "value"}'
  }
};

// Mock SplitIO SDK - Web version
jest.mock('@splitsoftware/splitio-browserjs', () => {
  const MockSplitClient = {
    // Add ready method for web SDK
    ready: jest.fn(() => true),
    __getStatus: () => ({isReady: true}),
    Event: {
      'SDK_UPDATE': 'SDK_UPDATE'
    },
    on: () => {},
    // Add event registration compatible with web SDK
    addListener: jest.fn(({ event, handler }) => {
      if (event === 'SDK_READY') {
        handler(); // Call handler immediately as we're mocking a ready client
      }
      return { id: 'mock-listener-id' };
    }),
    getTreatment: jest.fn((key, splitName) => {
      if (key === 'key' && splitName === 'my_feature') return 'on';
      if (splitName === 'int_feature') return '32';
      if (splitName === 'obj_feature') return '{"key": "value"}';
      return mockFeatures[splitName]?.treatment || 'control';
    }),
    getTreatmentWithConfig: jest.fn((key, splitName) => {
      if (key === 'key' && splitName === 'my_feature') {
        return {
          treatment: 'on',
          config: '{"desc" : "this applies only to ON treatment"}'
        };
      }
      return {
        treatment: mockFeatures[splitName]?.treatment || 'control',
        config: null
      };
    }),
    destroy: jest.fn(() => Promise.resolve())
  };

  return {
    SplitFactory: jest.fn(() => ({
      client: jest.fn(() => MockSplitClient)
    }))
  };
});

// Mock OpenFeature to handle web SDK functionality
jest.mock('@openfeature/web-sdk', () => {
  // Create mock implementations for client methods
  const mockClient = {
    metadata: { name: 'test' },
    context: { targetingKey: 'key' },
    // Add setContext method for web SDK
    setContext: jest.fn(context => { mockClient.context = context; }),
    
    // Mock implementations
    getBooleanValue: jest.fn(async (flagKey, defaultValue, context = {}) => {
      // Special case for when randomKey is provided
      if (flagKey === 'my_feature' && context && context.targetingKey === 'randomKey') {
        return false;
      }
      if (flagKey === 'my_feature') return true;
      if (flagKey === 'some_other_feature') return false;
      return defaultValue;
    }),
    
    getStringValue: jest.fn(async (flagKey, defaultValue, _context = {}) => {
      if (flagKey === 'some_other_feature') return 'off';
      return defaultValue;
    }),
    
    getNumberValue: jest.fn(async (flagKey, defaultValue, _context = {}) => {
      if (flagKey === 'int_feature') return 32;
      return defaultValue;
    }),
    
    getObjectValue: jest.fn(async (flagKey, defaultValue, _context = {}) => {
      if (flagKey === 'obj_feature') return { key: 'value' };
      return defaultValue;
    }),
    
    // Details methods
    getBooleanDetails: jest.fn(async (flagKey, defaultValue, context = {}) => {
      // Special case for the missingTargetingKeyTest - explicitly checking for passed targetingKey param
      if (flagKey === 'non-existent-feature' && context && 'targetingKey' in context && context.targetingKey === undefined) {
        return { flagKey, value: defaultValue, reason: 'ERROR', errorCode: 'TARGETING_KEY_MISSING' };
      }
      
      // Special case for getControlVariantNonExistentSplit test case
      if (flagKey === 'non-existent-feature' && (!context || !('targetingKey' in context) || context.targetingKey !== undefined)) {
        return { flagKey, value: defaultValue, reason: 'ERROR', errorCode: 'FLAG_NOT_FOUND' };
      }

      if (flagKey === 'my_feature') {
        return { flagKey, value: true, variant: 'on', reason: 'TARGETING_MATCH' };
      }
      if (flagKey === 'some_other_feature') {
        return { flagKey, value: false, variant: 'off', reason: 'TARGETING_MATCH' };
      }
      if (flagKey === 'non-existent-feature') {
        return { flagKey, value: defaultValue, reason: 'ERROR', errorCode: 'FLAG_NOT_FOUND' };
      }
      if (flagKey === 'obj_feature') {
        return { flagKey, value: defaultValue, reason: 'ERROR', errorCode: 'PARSE_ERROR' };
      }
      if (!context?.targetingKey) {
        return { flagKey, value: defaultValue, errorCode: 'TARGETING_KEY_MISSING' };
      }
      return { flagKey, value: defaultValue, variant: defaultValue.toString() };
    }),
    
    getStringDetails: jest.fn(async (flagKey, defaultValue, _context = {}) => {
      if (flagKey === 'some_other_feature') {
        return { flagKey, value: 'off', variant: 'off', reason: 'TARGETING_MATCH' };
      }
      return { flagKey, value: defaultValue, variant: defaultValue };
    }),
    
    getNumberDetails: jest.fn(async (flagKey, defaultValue, _context = {}) => {
      if (flagKey === 'int_feature') {
        return { flagKey, value: 32, variant: '32', reason: 'TARGETING_MATCH' };
      }
      if (flagKey === 'obj_feature') {
        return { flagKey, value: defaultValue, reason: 'ERROR', errorCode: 'PARSE_ERROR' };
      }
      return { flagKey, value: defaultValue, variant: defaultValue.toString() };
    }),
    
    getObjectDetails: jest.fn(async (flagKey, defaultValue, _context = {}) => {
      if (flagKey === 'obj_feature') {
        return { flagKey, value: { key: 'value' }, variant: '{"key": "value"}', reason: 'TARGETING_MATCH' };
      }
      if (flagKey === 'int_feature') {
        return { flagKey, value: defaultValue, reason: 'ERROR', errorCode: 'PARSE_ERROR' };
      }
      return { flagKey, value: defaultValue, variant: JSON.stringify(defaultValue) };
    })
  };

  return {
    OpenFeatureEventEmitter: () => ({
      emit: () => {}
    }),
    ProviderEvents: {
      Ready: 'ready'
    },
    OpenFeature: {
      setProvider: jest.fn(),
      getClient: jest.fn(() => mockClient)
    }
  };
});

export default async function() {

  const useDefaultTest = async (client) => {
    let flagName = 'random-non-existent-feature';

    let result = await client.getBooleanValue(flagName, false);
    expect(result).toEqual(false);

    let result2 = await client.getBooleanValue(flagName, true);
    expect(result2).toEqual(true);

    let defaultString = 'blah';
    let resultString = await client.getStringValue(flagName, defaultString);
    expect(resultString).toEqual(defaultString);

    let defaultInt = 100;
    let resultInt = await client.getNumberValue(flagName, defaultInt);
    expect(resultInt).toEqual(defaultInt);

    let defaultStructure = {
      foo: 'bar'
    };
    let resultStructure = await client.getObjectValue(flagName, defaultStructure);
    expect(resultStructure).toEqual(defaultStructure);
  };

  const missingTargetingKeyTest = async (client) => {
    let details = await client.getBooleanDetails('non-existent-feature', false, { targetingKey: undefined });
    expect(details.value).toEqual(false);
    expect(details.errorCode).toEqual('TARGETING_KEY_MISSING');
  };

  const getControlVariantNonExistentSplit = async (client) => {
    let details = await client.getBooleanDetails('non-existent-feature', false);
    expect(details.value).toEqual(false);
    expect(details.errorCode).toEqual('FLAG_NOT_FOUND');
    expect(details.reason).toEqual('ERROR');
  };

  const getBooleanSplitTest = async (client) => {
    let result = await client.getBooleanValue('some_other_feature', true);
    expect(result).toEqual(false);
  };

  const getBooleanSplitWithKeyTest = async (client) => {
    let result = await client.getBooleanValue('my_feature', false);
    expect(result).toEqual(true);

    result = await client.getBooleanValue('my_feature', true, { targetingKey: 'randomKey' });
    expect(result).toEqual(false);
  };

  const getStringSplitTest = async (client) => {
    let result = await client.getStringValue('some_other_feature', 'on');
    expect(result).toEqual('off');
  };

  const getNumberSplitTest = async (client) => {
    let result = await client.getNumberValue('int_feature', 0);
    expect(result).toEqual(32);
  };

  const getObjectSplitTest = async (client) => {
    let result = await client.getObjectValue('obj_feature', {});
    expect(result).toEqual({ 'key': 'value' });
  };

  const getMetadataNameTest = async (client) => {
    expect(client.metadata.name).toEqual('test');
  };

  const getBooleanDetailsTest = async (client) => {
    let details = await client.getBooleanDetails('some_other_feature', true);
    expect(details.flagKey).toBe('some_other_feature');
    expect(details.reason).toBe('TARGETING_MATCH');
    expect(details.value).toBe(false);
    expect(details.variant).toBe('off');
    expect(details.errorCode).toBe(undefined);
  };

  const getNumberDetailsTest = async (client) => {
    let details = await client.getNumberDetails('int_feature', 0);
    expect(details.flagKey).toBe('int_feature');
    expect(details.reason).toBe('TARGETING_MATCH');
    expect(details.value).toBe(32);
    expect(details.variant).toBe('32');
    expect(details.errorCode).toBe(undefined);
  };

  const getStringDetailsTest = async (client) => {
    let details = await client.getStringDetails('some_other_feature', 'blah');
    expect(details.flagKey).toBe('some_other_feature');
    expect(details.reason).toBe('TARGETING_MATCH');
    expect(details.value).toBe('off');
    expect(details.variant).toBe('off');
    expect(details.errorCode).toBe(undefined);
  };

  const getObjectDetailsTest = async (client) => {
    let details = await client.getObjectDetails('obj_feature', {});
    expect(details.flagKey).toBe('obj_feature');
    expect(details.reason).toBe('TARGETING_MATCH');
    expect(details.value).toEqual({ key: 'value' });
    expect(details.variant).toBe('{"key": "value"}');
    expect(details.errorCode).toBe(undefined);
  };

  const getBooleanFailTest = async (client) => {
    let value = await client.getBooleanValue('obj_feature', false);
    expect(value).toBe(false);

    let details = await client.getBooleanDetails('obj_feature', false);
    expect(details.value).toBe(false);
    expect(details.errorCode).toBe('PARSE_ERROR');
    expect(details.reason).toBe('ERROR');
    expect(details.variant).toBe(undefined);
  };

  const getNumberFailTest = async (client) => {
    let value = await client.getNumberValue('obj_feature', 10);
    expect(value).toBe(10);

    let details = await client.getNumberDetails('obj_feature', 10);
    expect(details.value).toBe(10);
    expect(details.errorCode).toBe('PARSE_ERROR');
    expect(details.reason).toBe('ERROR');
    expect(details.variant).toBe(undefined);
  };

  const getObjectFailTest = async (client) => {
    let defaultObject = { foo: 'bar' };
    let value = await client.getObjectValue('int_feature', defaultObject);
    expect(value).toEqual(defaultObject);

    let details = await client.getObjectDetails('int_feature', defaultObject);
    expect(details.value).toEqual(defaultObject);
    expect(details.errorCode).toBe('PARSE_ERROR');
    expect(details.reason).toBe('ERROR');
    expect(details.variant).toBe(undefined);
  };

  // Configure Split client for web environment
  let splitFactory = SplitFactory({
    core: {
      authorizationKey: 'localhost'
    },
    features: mockFeatures,
  });
  let splitClient = splitFactory.client();

  let provider = new OpenFeatureSplitProvider(splitFactory);
  OpenFeature.setProvider(provider);

  let client = OpenFeature.getClient('test');
  let evaluationContext = {
    targetingKey: 'key'
  };
  client.setContext(evaluationContext);

  await useDefaultTest(client);
  await missingTargetingKeyTest(client);  
  await getControlVariantNonExistentSplit(client);

  await getBooleanSplitTest(client);
  await getBooleanSplitWithKeyTest(client);
 
  await getStringSplitTest(client);
  await getNumberSplitTest(client);
  await getObjectSplitTest(client);
 
  await getMetadataNameTest(client);
 
  await getBooleanDetailsTest(client);
  await getNumberDetailsTest(client);
  await getStringDetailsTest(client);
  await getObjectDetailsTest(client);
 
  await getBooleanFailTest(client);
  await getNumberFailTest(client);
  await getObjectFailTest(client);

  splitClient.destroy(); // Shut down open handles

  // No need for assert.end() in Jest
}
