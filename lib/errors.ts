export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function errorDetail(error: unknown): string {
  const message = errorMessage(error);
  if (
    error instanceof Error &&
    error.cause &&
    typeof error.cause === 'object' &&
    'code' in error.cause
  ) {
    return `${message} (${String(error.cause.code)})`;
  }
  return message;
}

export class CrawlBusyError extends Error {}
