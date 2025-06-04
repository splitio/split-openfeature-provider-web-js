module.exports = {
  displayName: 'openfeature-web-split-provider',
  testEnvironment: 'jsdom',
  testMatch: ['**/web.spec.js'],
  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/tsconfig.json',
    },
  },
  transform: {
    '^.+\\.[tj]sx?$': 'ts-jest',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'html'],
  coverageDirectory: './coverage',
};
