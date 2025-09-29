import { OpenFeature } from '@openfeature/web-sdk';
import { SplitFactory } from '@splitsoftware/splitio-browserjs';
import { OpenFeatureSplitProvider } from '../../lib/js-split-provider';

describe('OpenFeature Split Provider - Debug Tests', () => {
  let client;
  let splitClient;

  beforeAll(async () => {
    // Create with more debug options
    const splitFactory = SplitFactory({
      core: {
        authorizationKey: 'localhost',
      },
      // Define the features directly
      features: {
        'my_feature': 'on',
        'some_other_feature': 'off',
        'int_feature': '32',
        'obj_feature': '{"key": "value"}'
      }
    });
    splitClient =splitFactory.client();
    
    // Add direct Split client test to verify it works as expected
    console.log('Direct Split client test:');
    console.log('- my_feature:', splitClient.getTreatment('my_feature'));
    console.log('- some_other_feature:', splitClient.getTreatment('some_other_feature'));
    console.log('- int_feature:', splitClient.getTreatment('int_feature'));
    console.log('- obj_feature:', splitClient.getTreatment('obj_feature'));
    
    // Create provider
    const provider = new OpenFeatureSplitProvider(splitFactory);

    // Register provider
    OpenFeature.setProvider(provider);
    
    // Get client
    client = OpenFeature.getClient('debug-test');
    
    // Context we'll use in tests
    const context = { targetingKey: 'test-user' };
    
    // Test OpenFeature client directly in setup to debug issues
    try {
      const boolResult = await client.getBooleanValue('my_feature', false, context);
      console.log('OpenFeature boolean test:', boolResult);

      const stringResult = await client.getStringValue('some_other_feature', 'default', context);
      console.log('OpenFeature string test:', stringResult);

      const numberResult = await client.getNumberValue('int_feature', 0, context);
      console.log('OpenFeature number test:', numberResult);

      const objectResult = await client.getObjectValue('obj_feature', {}, context);
      console.log('OpenFeature object test:', objectResult);
    } catch (e) {
      console.error('Error in OpenFeature test:', e);
    }
  });

  afterAll(async () => {
    if (splitClient) {
      await splitClient.destroy();
    }
  });

  // Simple test to verify we can run a test at all
  test('should create client and provider', () => {
    expect(client).toBeDefined();
    expect(splitClient).toBeDefined();
  });

  // Basic test to validate Split direct API
  test('Split client works directly', () => {
    const treatment = splitClient.getTreatment('my_feature');
    expect(treatment).toBe('on');
  });
});
