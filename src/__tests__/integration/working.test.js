import { OpenFeature } from '@openfeature/web-sdk';
import { SplitFactory } from '@splitsoftware/splitio-browserjs';
import { OpenFeatureSplitProvider } from '../../lib/js-split-provider';

describe('OpenFeature Split Provider - Working Integration Test', () => {
  let client;
  let provider;
  let splitClient;

  // Properly define the split treatments for localhost mode
  const localFeatures = {
    // Define features with proper structure
    'my_feature': {
      treatment: 'on',
      config: '{"desc": "this is a test"}'
    },
    'some_other_feature': 'off',
    'int_feature': '32',
    'obj_feature': '{"key": "value"}'
  };

  beforeEach(async () => {
    // Create client
    const splitFactory = SplitFactory({
      core: {
        authorizationKey: 'localhost'
      },
      features: localFeatures
    })
    splitClient = splitFactory.client();

    provider = new OpenFeatureSplitProvider(splitFactory);
    
    OpenFeature.setProvider(provider);
    OpenFeature.setContext({targetingKey: 'user1'})
    client = OpenFeature.getClient('test');
      
  });

  afterEach(async () => {
    await splitClient.destroy();
  });

  test('boolean treatment evaluations', async () => {
    
    // Test the boolean value evaluation
    const result = await client.getBooleanValue('my_feature', false);
    expect(result).toBe(true);
  });

  test('boolean treatment details evaluations', async () => {
    
    // Test the boolean value evaluation
    const result = await client.getBooleanDetails('my_feature', false);
    expect(result.value).toBe(true);
    expect(result.flagMetadata.config).toBe('{"desc": "this is a test"}')
  });

  // Add a test for string treatment
  test('string treatment evaluations', async () => {
    const result = await client.getStringValue('some_other_feature', 'default');
    expect(result).toBe('off');
  });

  // Add a test for number treatment
  test('number treatment evaluations', async () => {
    const result = await client.getNumberValue('int_feature', 0);
    expect(result).toBe(32);
  });

  // Add a test for object treatment
  test('object treatment evaluations', async () => {
    const result = await client.getObjectValue('obj_feature', {});
    expect(result).toEqual({ key: 'value' });
  });
});
