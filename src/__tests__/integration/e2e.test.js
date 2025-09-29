import { OpenFeature } from '@openfeature/web-sdk';
import { SplitFactory } from '@splitsoftware/splitio-browserjs';
import { OpenFeatureSplitProvider } from '../../lib/js-split-provider';

// This is an end-to-end integration test that uses real clients (no mocks)
// It uses a local split.yaml file for feature flag definitions

describe('OpenFeature Split Provider - E2E Integration Tests', () => {
  let client;
  let splitClient;

  // Set up before all tests
  beforeAll(async () => {
    // Initialize the Split client in localhost mode
    const splitFactory = SplitFactory({
      core: {
        authorizationKey: 'localhost'
      },
      features: {
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
      }
    })
    splitClient = splitFactory.client();

    // Wait for the client to be ready
    await new Promise((resolve) => {
      if (splitClient.ready()) {
        console.log('Split client is already ready');
        resolve();
      } else {
        console.log('Waiting for Split client to be ready...');
        splitClient.on('SDK_READY', () => {
          console.log('Split client is now ready');
          resolve();
        });
        
        // Add timeout just in case
        setTimeout(() => {
          console.warn('Split client ready timeout - continuing anyway');
          resolve();
        }, 5000);
      }
    });

    // Create the Split provider with the real Split client
    const provider = new OpenFeatureSplitProvider(splitFactory);

    // Register the provider with OpenFeature
    OpenFeature.setProvider(provider);

    // Set context
    await OpenFeature.setContext({ targetingKey: "key" });

    // Create a new OpenFeature client
    client = OpenFeature.getClient('integration-test');

    // Note: In web SDK we don't set context globally
    // Instead, we'll pass the context with each call
    
    // Print confirmation message
    console.log('Setup complete - OpenFeature provider registered');
  }, 10000); // Allow up to 10 seconds for setup

  // No per-test cleanup needed as we're using the same client for all tests
  
  // Clean up after all tests
  afterAll(async () => {
    // Destroy the Split client to prevent memory leaks
    if (splitClient) {
      console.log('Destroying Split client...');
      await splitClient.destroy();
      console.log('Split client destroyed');
    }
  });

  describe('Boolean evaluations', () => {
    test('should correctly evaluate a boolean flag that is ON', async () => {
      const result = await client.getBooleanValue('my_feature', false);
      expect(result).toBe(true);
    });

    test('should correctly evaluate a boolean flag that is OFF', async () => {
      const result = await client.getBooleanValue('some_other_feature', true);
      expect(result).toBe(false);
    });

    test('should return details for boolean flag evaluation', async () => {
      const details = await client.getBooleanDetails('my_feature', false);
      expect(details.value).toBe(true);
      expect(details.flagKey).toBe('my_feature');
      expect(details.reason).toBe('TARGETING_MATCH');
      expect(details.variant).toBe('on');
      expect(details.flagMetadata.config).toBe('{"desc": "this is a test"}')
    });
  });

  describe('String evaluations', () => {
    test('should correctly evaluate a string flag', async () => {
      // Since "some_other_feature" has treatment "off", it should return "off" as string
      const result = await client.getStringValue('some_other_feature', 'default');
      expect(result).toBe('off');
    });

    test('should return details for string flag evaluation', async () => {
      const details = await client.getStringDetails('some_other_feature', 'default');
      expect(details.value).toBe('off');
      expect(details.flagKey).toBe('some_other_feature');
      expect(details.reason).toBe('TARGETING_MATCH');
      expect(details.variant).toBe('off');
    });
  });

  describe('Number evaluations', () => {
    test('should correctly evaluate a number flag', async () => {
      const result = await client.getNumberValue('int_feature', 0);
      expect(result).toBe(32);
    });

    test('should return details for number flag evaluation', async () => {
      const details = await client.getNumberDetails('int_feature', 0);
      expect(details.value).toBe(32);
      expect(details.flagKey).toBe('int_feature');
      expect(details.reason).toBe('TARGETING_MATCH');
      expect(details.variant).toBe('32');
    });
  });

  describe('Object evaluations', () => {
    test('should correctly evaluate an object flag', async () => {
      const result = await client.getObjectValue('obj_feature', {});
      expect(result).toEqual({ key: 'value' });
    });

    test('should return details for object flag evaluation', async () => {
      const details = await client.getObjectDetails('obj_feature', {});
      expect(details.value).toEqual({ key: 'value' });
      expect(details.flagKey).toBe('obj_feature');
      expect(details.reason).toBe('TARGETING_MATCH');
      expect(details.variant).toBe('{"key": "value"}');
    });
  });

  describe('Configuration', () => {
    test('should provide configuration from treatment', async () => {
      // The split.yaml defines a config for my_feature
      const details = await client.getBooleanDetails('my_feature', false);
      
      // Should have configuration data
      expect(details.value).toBe(true);
      expect(details.flagKey).toBe('my_feature');
      expect(details.variant).toBe('on');
      expect(details.reason).toBe('TARGETING_MATCH');
      expect(details.flagMetadata.config).toBe('{"desc": "this is a test"}')
    });
  });
});
