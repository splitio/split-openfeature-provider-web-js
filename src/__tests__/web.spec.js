import clientSuite from './webSuites/client.spec.js';

describe('OpenFeature Web Split Provider - tests', () => {
  test('Client Tests', async () => {
    await clientSuite();
    expect(true).toBe(true)
  });
});