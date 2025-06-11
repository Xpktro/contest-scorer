// Only run the CLI when this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  await import('./cli')
}

// Export everything from the library for users importing this as a module
export * from './lib'
export type * from './types'
