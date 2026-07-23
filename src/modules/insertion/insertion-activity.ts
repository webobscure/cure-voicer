let activeInsertionCount = 0

export function isTextInsertionInProgress(): boolean {
  return activeInsertionCount > 0
}

export async function runWithInsertionActivity<T>(operation: () => Promise<T>): Promise<T> {
  activeInsertionCount += 1
  try {
    return await operation()
  } finally {
    activeInsertionCount -= 1
  }
}
