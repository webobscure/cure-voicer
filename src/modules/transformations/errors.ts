export class TransformationUnavailableError extends Error {
  readonly code = 'TRANSFORMATION_UNAVAILABLE'

  constructor(transformationId: string) {
    super(`Text transformation ${transformationId} is unavailable`)
    this.name = 'TransformationUnavailableError'
  }
}

export class TransformationCancelledError extends Error {
  readonly code = 'TRANSFORMATION_CANCELLED'

  constructor() {
    super('Text transformation was cancelled')
    this.name = 'TransformationCancelledError'
  }
}
