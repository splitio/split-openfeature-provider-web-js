import { OpenFeature } from '@openfeature/web-sdk';
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
let mockSplitClient;

// Mock SplitIO SDK - Web version
jest.mock('@splitsoftware/splitio-browserjs', () => {
  mockSplitClient = {
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
    getTreatmentWithConfig: jest.fn((splitName) => {
      if (splitName === 'my_feature') return { treatment: 'on'};
      if (splitName === 'int_feature') return { treatment: '32'};
      if (splitName === 'obj_feature') return { treatment: '{"key": "value"}'};
      if (splitName === 'my_feature') {
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
    track: jest.fn(()=>{}),
    destroy: jest.fn(() => Promise.resolve())
  };

  return {
    SplitFactory: jest.fn(() => ({
      client: jest.fn(() => mockSplitClient)
    }))
  };
});

// Configure Split client for web environment
let splitFactory = SplitFactory({
  core: {
    authorizationKey: 'localhost'
  },
  features: mockFeatures,
});

let provider = new OpenFeatureSplitProvider(splitFactory);
OpenFeature.setProviderAndWait(provider);

let evaluationContext = {
  targetingKey: 'key'
};
OpenFeature.setContext(evaluationContext);
let client = OpenFeature.getClient('test');


describe('OpenFeatureSplitProvider Unit Tests', () => {

  test('useDefaultTest', () => {
    let flagName = 'random-non-existent-feature';

    let result = client.getBooleanValue(flagName, false);
    expect(result).toEqual(false);

    let result2 = client.getBooleanValue(flagName, true);
    expect(result2).toEqual(true);

    let defaultString = 'blah';
    let resultString = client.getStringValue(flagName, defaultString);
    expect(resultString).toEqual(defaultString);

    let defaultInt = 100;
    let resultInt = client.getNumberValue(flagName, defaultInt);
    expect(resultInt).toEqual(defaultInt);

    let defaultStructure = {
      foo: 'bar'
    };
    let resultStructure = client.getObjectValue(flagName, defaultStructure);
    expect(resultStructure).toEqual(defaultStructure);
  });

  test('getControlVariantNonExistentSplit', () => {
    let details = client.getBooleanDetails('non-existent-feature', false);
    expect(details.value).toEqual(false);
    expect(details.errorCode).toEqual('FLAG_NOT_FOUND');
    expect(details.reason).toEqual('ERROR');
  });

  test('getBooleanSplitTest', () => {
    let result = client.getBooleanValue('some_other_feature', true);
    expect(result).toEqual(false);
  });

  test('getStringSplitTest', () => {
    let result = client.getStringValue('some_other_feature', 'on');
    expect(result).toEqual('off');
  });

  test('getNumberSplitTest', () => {
    let result = client.getNumberValue('int_feature', 0);
    expect(result).toEqual(32);
  });

  test('getObjectSplitTest', () => {
    let result = client.getObjectValue('obj_feature', {});
    expect(result).toEqual({ 'key': 'value' });
  });

  test('getMetadataNameTest', () => {
    expect(client.metadata.name).toEqual('test');
  });

  test('getBooleanDetailsTest', () => {
    let details = client.getBooleanDetails('some_other_feature', true);
    expect(details.flagKey).toBe('some_other_feature');
    expect(details.reason).toBe('TARGETING_MATCH');
    expect(details.value).toBe(false);
    expect(details.variant).toBe('off');
    expect(details.errorCode).toBe(undefined);
  });

  test('getNumberDetailsTest', () => {
    let details = client.getNumberDetails('int_feature', 0);
    expect(details.flagKey).toBe('int_feature');
    expect(details.reason).toBe('TARGETING_MATCH');
    expect(details.value).toBe(32);
    expect(details.variant).toBe('32');
    expect(details.errorCode).toBe(undefined);
  });

  test('getStringDetailsTest', () => {
    let details = client.getStringDetails('some_other_feature', 'blah');
    expect(details.flagKey).toBe('some_other_feature');
    expect(details.reason).toBe('TARGETING_MATCH');
    expect(details.value).toBe('off');
    expect(details.variant).toBe('off');
    expect(details.errorCode).toBe(undefined);
  });

  test('getObjectDetailsTest', () => {
    let details = client.getObjectDetails('obj_feature', {});
    expect(details.flagKey).toBe('obj_feature');
    expect(details.reason).toBe('TARGETING_MATCH');
    expect(details.value).toEqual({ key: 'value' });
    expect(details.variant).toBe('{"key": "value"}');
    expect(details.errorCode).toBe(undefined);
  });

  test('getBooleanFailTest', () => {
    let value = client.getBooleanValue('obj_feature', false);
    expect(value).toBe(false);

    let details = client.getBooleanDetails('obj_feature', false);
    expect(details.value).toBe(false);
    expect(details.errorCode).toBe('PARSE_ERROR');
    expect(details.reason).toBe('ERROR');
    expect(details.variant).toBe(undefined);
  });

  test('getNumberFailTest', () => {
    let value = client.getNumberValue('obj_feature', 10);
    expect(value).toBe(10);

    let details = client.getNumberDetails('obj_feature', 10);
    expect(details.value).toBe(10);
    expect(details.errorCode).toBe('PARSE_ERROR');
    expect(details.reason).toBe('ERROR');
    expect(details.variant).toBe(undefined);
  });

  test('getObjectFailTest', () => {
    let defaultObject = { foo: 'bar' };
    let value = client.getObjectValue('int_feature', defaultObject);
    expect(value).toEqual(defaultObject);

    let details = client.getObjectDetails('int_feature', defaultObject);
    expect(details.value).toEqual(defaultObject);
    expect(details.errorCode).toBe('PARSE_ERROR');
    expect(details.reason).toBe('ERROR');
    expect(details.variant).toBe(undefined);
  });
});