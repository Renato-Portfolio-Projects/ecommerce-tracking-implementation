import { createServer, type IncomingMessage } from 'node:http';

/**
 * A small stand-in for Upstash's web interface, so that the real client (@upstash/redis) can be tested end to end, over
 * a real connection on this machine, without the real database. It answers the few commands the store uses, and it
 * writes down every request it gets, so a test can read off exactly what the client sent. It speaks the way Upstash does:
 * one command at `/`, several as a transaction at `/multi-exec`, an answer of `{ result }` for each, and strings encoded
 * as base64 when the client asks for that.
 */
export interface RecordedRequest {
  path: string;
  headers: Record<string, string | string[] | undefined>;
  body: unknown;
}

export interface FakeUpstash {
  url: string;
  token: string;
  /** Every request the fake received, in order. */
  requests: RecordedRequest[];
  /** What it holds now: hashes, counters and the seconds each key has left. */
  hashes: Map<string, Map<string, string>>;
  counters: Map<string, number>;
  expiries: Map<string, number>;
  close(): Promise<void>;
}

const readBody = (request: IncomingMessage): Promise<string> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk) => chunks.push(chunk));
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    request.on('error', reject);
  });

export async function startFakeUpstash(token = 'a-token-for-the-fake', options: { forgetExpiry?: boolean } = {}): Promise<FakeUpstash> {
  const requests: RecordedRequest[] = [];
  const hashes = new Map<string, Map<string, string>>();
  const counters = new Map<string, number>();
  const expiries = new Map<string, number>();

  /** Runs one command the way Redis does, giving the value that goes in `result`. */
  const run = (command: unknown[]): unknown => {
    const [name, key, ...rest] = command.map((part) => (typeof part === 'string' ? part : String(part)));
    switch (name.toUpperCase()) {
      case 'INCR': {
        const count = (counters.get(key) ?? 0) + 1;
        counters.set(key, count);
        return count;
      }
      case 'EXPIRE':
        if (!counters.has(key) && !hashes.has(key)) return 0;
        // A database that says the expiry was set and does not keep it is what a test of the smoke script needs.
        if (!options.forgetExpiry) expiries.set(key, Number(rest[0]));
        return 1;
      case 'HSET': {
        const hash = hashes.get(key) ?? new Map<string, string>();
        let added = 0;
        for (let i = 0; i < rest.length; i += 2) {
          if (!hash.has(rest[i])) added += 1;
          hash.set(rest[i], rest[i + 1]);
        }
        hashes.set(key, hash);
        return added;
      }
      case 'HGETALL':
        return [...(hashes.get(key) ?? new Map<string, string>()).entries()].flat();
      case 'TTL':
        return counters.has(key) || hashes.has(key) ? (expiries.get(key) ?? -1) : -2;
      case 'DEL': {
        let removed = 0;
        for (const name of [key, ...rest]) {
          if (counters.delete(name) || hashes.delete(name)) removed += 1;
          expiries.delete(name);
        }
        return removed;
      }
      default:
        throw new Error(`the fake does not know ${name}`);
    }
  };

  /** Strings are sent as base64 when the client asked for it, and everything else as it is. */
  const encode = (value: unknown, base64: boolean): unknown => {
    if (!base64) return value;
    if (typeof value === 'string') return Buffer.from(value, 'utf8').toString('base64');
    if (Array.isArray(value)) return value.map((item) => encode(item, base64));
    return value;
  };

  const server = createServer(async (request, response) => {
    const text = await readBody(request);
    let body: unknown;
    try {
      body = text === '' ? undefined : JSON.parse(text);
    } catch {
      body = text;
    }
    requests.push({ path: request.url ?? '', headers: request.headers, body });
    const reply = (status: number, payload: unknown) => {
      response.writeHead(status, { 'content-type': 'application/json' });
      response.end(JSON.stringify(payload));
    };
    if (request.headers.authorization !== `Bearer ${token}`) return reply(401, { error: 'Unauthorized' });
    const base64 = request.headers['upstash-encoding'] === 'base64';
    try {
      const path = (request.url ?? '/').split('?')[0];
      if (path === '/multi-exec' || path === '/pipeline') {
        return reply(200, (body as unknown[][]).map((command) => ({ result: encode(run(command), base64) })));
      }
      return reply(200, { result: encode(run(body as unknown[]), base64) });
    } catch (error) {
      return reply(400, { error: error instanceof Error ? error.message : 'error' });
    }
  });

  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  const address = server.address();
  const port = typeof address === 'object' && address !== null ? address.port : 0;
  return {
    url: `http://127.0.0.1:${port}`,
    token,
    requests,
    hashes,
    counters,
    expiries,
    close: () => new Promise((done) => server.close(() => done())),
  };
}
