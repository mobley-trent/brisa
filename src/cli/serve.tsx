import fs from "node:fs";
import path from "node:path";

import LoadLayout from "../utils/load-layout";
import getRootDir from "../utils/get-root-dir";
import getRouteMatcher from "../utils/get-route-matcher";
import { BunriseRequest, renderToReadableStream } from "../bunrise";
import { LiveReloadScript } from "./dev-live-reload";
import { MatchedRoute, ServerWebSocket } from "bun";
import importFileIfExists from "../utils/import-file-if-exists";
import getLocaleFromRequest from "../utils/get-locale-from-request";
import removeLocaleFromUrl from "../utils/remove-locale-from-url";

declare global {
  var ws: ServerWebSocket<unknown> | undefined;
}

const PAGE_404 = "/_404";
const PAGE_500 = "/_500";
const RESERVED_PAGES = [PAGE_404, PAGE_500];
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const port = parseInt(process.argv[2]) || 3000;
const rootDir = getRootDir();
const assetsDir = path.join(rootDir, "public");
const pagesDir = path.join(rootDir, "pages");

if (IS_PRODUCTION && !fs.existsSync(rootDir)) {
  console.error('Not exist "build" yet. Please run "bunrise build" first');
  process.exit(1);
}

if (!fs.existsSync(pagesDir)) {
  const path = IS_PRODUCTION ? "build/pages" : "src/pages";
  const cli = IS_PRODUCTION ? "bunrise start" : "bunrise dev";

  console.error(`Not exist ${path}" directory. It\'s required to run "${cli}"`);
  process.exit(1);
}

const pagesRouter = getRouteMatcher(pagesDir, RESERVED_PAGES);
const rootRouter = getRouteMatcher(rootDir);
const customMiddleware = await importFileIfExists("middleware");
const i18nConfig = await importFileIfExists("i18n");

const responseInitWithGzip = {
  headers: {
    "content-encoding": "gzip",
    vary: "Accept-Encoding",
  },
};

// Start server
Bun.serve({
  port,
  development: !IS_PRODUCTION,
  async fetch(req: Request, server) {
    if (server.upgrade(req)) return;
    let bunriseRequest = new BunriseRequest(req);

    // i18n
    if (i18nConfig && i18nConfig.locales && i18nConfig.defaultLocale) {
      const locale = getLocaleFromRequest(i18nConfig, bunriseRequest);
      const url = removeLocaleFromUrl(bunriseRequest.url, locale);
      bunriseRequest.url = url;
      bunriseRequest.i18n = {
        defaultLocale: i18nConfig.defaultLocale,
        locales: i18nConfig.locales,
        locale,
      };
    }

    return (
      handleRequest(bunriseRequest)
        // 500 page
        .catch((error) => {
          const route500 = pagesRouter.reservedRoutes[PAGE_500];
          if (!route500) throw error;
          return responseRenderedPage({
            req: bunriseRequest,
            route: route500,
            status: 500,
            error,
          });
        })
    );
  },
  websocket: {
    open: (ws: ServerWebSocket<unknown>) => {
      globalThis.ws = ws;
    },
    close: () => {
      globalThis.ws = undefined;
    },
    message: () => {
      /* void */
    },
  },
});

console.log(
  `Listening on http://localhost:${port} (${process.env.NODE_ENV})...`,
);

///////////////////////////////////////////////////////
////////////////////// HELPERS ///////////////////////
///////////////////////////////////////////////////////

async function handleRequest(req: BunriseRequest) {
  const url = new URL(req.url);
  const pathname = url.pathname;
  const { route, isReservedPathname } = pagesRouter.match(req);
  const isApi = pathname.startsWith("/api/");
  const api = isApi ? rootRouter.match(req) : null;
  const assetPath = path.join(assetsDir, pathname);

  // Middleware
  if (customMiddleware) {
    const middlewareResponse = await Promise.resolve().then(() =>
      customMiddleware(req),
    );
    if (middlewareResponse) return middlewareResponse;
  }

  // Pages
  if (!isApi && route && !isReservedPathname) {
    return responseRenderedPage({ req, route });
  }

  // Assets
  if (fs.existsSync(assetPath)) {
    const isGzip =
      IS_PRODUCTION && req.headers.get("accept-encoding")?.includes?.("gzip");

    const file = Bun.file(isGzip ? `${assetPath}.gz` : assetPath);
    const responseOptions = isGzip ? responseInitWithGzip : {};

    return new Response(file, responseOptions);
  }

  // API
  if (isApi && api?.route && !api?.isReservedPathname) {
    const module = await import(api.route.filePath);
    const method = req.method.toLowerCase();

    req.route = api.route;

    return module[method]?.(req);
  }

  // 404 page
  const route404 = pagesRouter.reservedRoutes[PAGE_404];

  return route404
    ? responseRenderedPage({ req, route: route404, status: 404 })
    : new Response("Not found", { status: 404 });
}

async function responseRenderedPage({
  req,
  route,
  status = 200,
  error,
}: {
  req: BunriseRequest;
  route: MatchedRoute;
  status?: number;
  error?: Error;
}) {
  const module = await import(route.filePath);
  const PageComponent = module.default;

  req.route = route;

  const pageElement = (
    <PageLayout>
      <PageComponent error={error} />
    </PageLayout>
  );

  const htmlStream = await renderToReadableStream(pageElement, req);
  const responseOptions = {
    headers: {
      "transfer-encoding": "chunked",
      vary: "Accept-Encoding",
      "content-type": "text/html; charset=utf-8",
    },
    status,
  };

  return new Response(htmlStream, responseOptions);
}

function PageLayout({ children }: { children: JSX.Element }) {
  const childrenWithLiveReload = IS_PRODUCTION ? (
    children
  ) : (
    <LiveReloadScript port={port}>{children}</LiveReloadScript>
  );

  return <LoadLayout>{childrenWithLiveReload}</LoadLayout>;
}
