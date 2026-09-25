import { storeIsOpen, type Environment } from './gate';

/**
 * The rules every server function follows, in one place, so that no function can forget one:
 * - it answers nothing, in the store's own words, while the store is closed (a 404 with a body of ours,
 *   which also tells a deployment that ran from one that was never there);
 * - it accepts only the methods it names, and says which (405);
 * - a fault gives a plain 500 that says nothing about the cause, and the log says only what kind of fault it
 *   was, never its message, since a message can carry what a visitor typed;
 * - every answer carries `Cache-Control: no-store`, because an answer can depend on who is asking, and a shared
 *   cache must never keep one visitor's answer for the next.
 */

const NO_STORE = 'no-store';

/** A JSON answer, marked not to be cached. `extra` adds headers, such as `Allow`. */
export function answer(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': NO_STORE, ...extra },
  });
}

/** What a closed store, or a function that is not there, says. */
export function notFound(): Response {
  return answer({ error: 'not found' }, 404);
}

/**
 * Wraps a function's real work in the rules above. `env` is read on every request, `methods` are the ones the
 * function accepts, and `work` runs only for an open store and an accepted method.
 */
export function guarded(
  env: Environment,
  methods: readonly string[],
  work: (request: Request) => Response | Promise<Response>,
): (request: Request) => Promise<Response> {
  return async (request) => {
    if (!storeIsOpen(env)) return notFound();
    if (!methods.includes(request.method)) {
      return answer({ error: 'method not allowed' }, 405, { allow: methods.join(', ') });
    }
    try {
      const response = await work(request);
      if (!response.headers.has('cache-control')) response.headers.set('cache-control', NO_STORE);
      return response;
    } catch (error) {
      console.error('A server function failed:', error instanceof Error ? error.name : typeof error);
      return answer({ error: 'something went wrong' }, 500);
    }
  };
}
