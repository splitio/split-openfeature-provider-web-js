import { OpenFeature } from '@openfeature/web-sdk';
import { SplitFactory } from '@splitsoftware/splitio';
import { OpenFeatureSplitProvider } from '../../lib/js-split-provider';

describe('OpenFeature Split Provider - Working Integration Test', () => {
  let client;
  let splitClient;

  // Properly define the split treatments for localhost mode
  const localFeatures = {
    // Define features with proper structure
    my_feature: {
      treatment: 'on',
      config: '{"desc": "this is a test"}'
    },
    some_other_feature: {
      treatment: 'off'
    },
    int_feature: {
      treatment: '32'
    },
    obj_feature: {
      treatment: '{"key": "value"}'
    }
  };

  beforeEach(async () => {
    // Initialize Split in a way that will definitely work
    return new Promise(resolve => {
      // Create client
      splitClient = SplitFactory({
        core: {
          authorizationKey: 'localhost'
        },
        mode: 'standalone',
        features: localFeatures,
        debug: true
      }).client();

      // Register event handler before anything else
      splitClient.on(splitClient.Event.SDK_READY, async () => {
        console.log('Split client is ready');

        // Test direct access first
        const directTest = splitClient.getTreatment('user1', 'my_feature');
        console.log('Direct test:', directTest);

        // Create and register the OpenFeature provider
        const provider = new OpenFeatureSplitProvider({
          splitClient
        });
        
        OpenFeature.setProvider(provider);
        client = OpenFeature.getClient('test');
        
        // Provider should now be ready
        console.log('Provider registered');
        
        // Resolve test setup
        resolve();
      });
    });
  }, 10000);

  afterEach(async () => {
    if (splitClient) {
      await splitClient.destroy();
    }
  });

  test('setup was successful', () => {
    expect(client).toBeDefined();
    expect(splitClient).toBeDefined();
  });

  test('direct Split client evaluation works', () => {
    // Directly test Split client first
    const treatment = splitClient.getTreatment('user1', 'my_feature');
    expect(treatment).toBe('on');
  });

  test('boolean treatment evaluations', async () => {
    // Set the targeting key for the evaluation
    const context = { targetingKey: 'user1' };
    
    // Test the boolean value evaluation
    const result = await client.getBooleanValue('my_feature', false, context);
    expect(result).toBe(true);
  });

  // Add a test for string treatment
  test('string treatment evaluations', async () => {
    const context = { targetingKey: 'user1' };
    const result = await client.getStringValue('some_other_feature', 'default', context);
    expect(result).toBe('off');
  });

  // Add a test for number treatment
  test('number treatment evaluations', async () => {
    const context = { targetingKey: 'user1' };
    const result = await client.getNumberValue('int_feature', 0, context);
    expect(result).toBe(32);
  });

  // Add a test for object treatment
  test('object treatment evaluations', async () => {
    const context = { targetingKey: 'user1' };
    const result = await client.getObjectValue('obj_feature', {}, context);
    expect(result).toEqual({ key: 'value' });
  });
});
