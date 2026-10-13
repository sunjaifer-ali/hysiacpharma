/** Client-only stand-in so the Windows bundle never loads TanStack Start. */
type Handler = (opts?: { data?: unknown; context?: unknown }) => unknown;

export function createServerFn(_opts?: unknown) {
  const builder = {
    middleware() {
      return builder;
    },
    validator() {
      return builder;
    },
    inputValidator() {
      return builder;
    },
    handler(fn: Handler) {
      return async (opts?: { data?: unknown }) => fn({ data: opts?.data, context: {} });
    },
  };
  return builder;
}

export function createMiddleware() {
  return {
    middleware() {
      return this;
    },
    server() {
      return this;
    },
    client() {
      return this;
    },
    handler(fn: Handler) {
      return fn;
    },
  };
}

export function createStart() {
  return {};
}
