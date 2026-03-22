import { sleep } from "./time";

type RetryOptions = {
  retries: number;
  baseDelayMs: number;
  shouldRetry?: (error: unknown) => boolean;
  getDelayMs?: (error: unknown, attempt: number, baseDelayMs: number) => number;
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
};

const defaultShouldRetry = () => true;

export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  const {
    retries,
    baseDelayMs,
    shouldRetry = defaultShouldRetry,
    getDelayMs,
    onRetry,
  } = options;

  let attempt = 0;

  while (true) {
    try {
      return await operation();
    } catch (error) {
      attempt += 1;

      if (attempt > retries || !shouldRetry(error)) {
        throw error;
      }

      const delayMs =
        getDelayMs?.(error, attempt, baseDelayMs) ??
        baseDelayMs * 2 ** (attempt - 1);

      onRetry?.(error, attempt, delayMs);
      await sleep(delayMs);
    }
  }
}
