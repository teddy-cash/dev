module.exports = {
  preset: 'ts-jest',
   globals: {
    'ts-jest': {
      tsconfig: true
    }
   },
  testTimeout: 20000,
  testEnvironment: 'node',
  "roots": [
    "<rootDir>/src"
  ],
  testMatch: [
    "**/__tests__/**/*.+(ts|tsx|js)",
    "**/?(*.)+(spec|test).+(ts|tsx|js)"
  ],
  transform: {
    "^.+\\.(ts|tsx)$": "ts-jest"
  }
}
