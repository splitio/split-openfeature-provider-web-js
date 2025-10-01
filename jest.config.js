export default {
  displayName: 'openfeature-web-split-provider',
  testEnvironment: 'jsdom',
  testMatch: ['**/*.spec.js', '**/integration/*.test.js'],
  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/tsconfig.json',
    },
  },
  transform: {
    '^.+\\.[tj]sx?$': 'ts-jest',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(fetch-mock)/)' 
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'html'],
  coverageDirectory: './coverage',
};
