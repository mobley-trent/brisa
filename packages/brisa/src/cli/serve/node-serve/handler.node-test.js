import { it, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import net from 'node:net';
import http from 'node:http';
import path from 'node:path';
import url from 'node:url';

const FIXTURES_DIR = path.resolve(
  import.meta.dirname,
  '..',
  '..',
  '..',
  '__fixtures__',
);

describe('Node.js handler', () => {
  beforeEach(() => {
    globalThis.mockConstants = undefined;
  });
  afterEach(() => {
    globalThis.mockConstants = undefined;
  });
  it('should resolve a page', async () => {
    globalThis.mockConstants = {
      IS_SERVE_PROCESS: true,
      ROOT_DIR: FIXTURES_DIR,
      SRC_DIR: path.join(FIXTURES_DIR, 'js'),
      BUILD_DIR: path.join(FIXTURES_DIR, 'js'),
      ASSETS_DIR: path.join(FIXTURES_DIR, 'public'),
      PAGES_DIR: path.join(FIXTURES_DIR, 'js', 'pages'),
      CONFIG: {},
      HEADERS: {
        CACHE_CONTROL: 'no-cache, no-store, must-revalidate',
      },
      LOG_PREFIX: {},
    };
    const req = new http.IncomingMessage(new net.Socket());
    req.url = '/';
    const res = createMockResponse(req);
    const absolutePath = url.pathToFileURL(
      path.resolve(import.meta.dirname, '../../../../server/node.js'),
    ).href;
    const handler = await import(absolutePath).then((m) => m.handler);
    await handler(req, res);
    assert.strictEqual(res.statusCode, 200);
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.strictEqual(res.getBody().includes('<title>Brisa</title><'), true);
  });
});

function createMockResponse(req) {
  const res = new http.ServerResponse(req);
  const originalWrite = res.write.bind(res);
  let body = '';

  return {
    write: (chunk) => {
      body += chunk;
      return originalWrite(chunk);
    },
    getBody: () => body,
    writeHead: res.writeHead.bind(res),
    on: res.on.bind(res),
    end: res.end.bind(res),
    off: res.off.bind(res),
    destroy: res.destroy.bind(res),
    get statusCode() {
      return res.statusCode;
    },
  };
}