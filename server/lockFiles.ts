import type { IncomingMessage, ServerResponse } from 'node:http';

const LOCK_CONTENT_TYPE = 'text/plain; charset=utf-8';

type RequestWithOriginalUrl = IncomingMessage & { originalUrl?: string };

export function isLockPath(url: string | undefined): boolean {
  if (!url) return false;
  return url.split('?')[0].toLowerCase().endsWith('.lock');
}

/**
 * AI Studio polls sibling `.lock` files as text. Unknown extensions usually
 * become application/octet-stream (and get downloaded), so pin the header in a
 * way later static middleware cannot overwrite.
 */
export function pinLockFileContentType(res: ServerResponse): void {
  const originalSetHeader = res.setHeader.bind(res);
  res.setHeader = ((name: string, value: number | string | readonly string[]) => {
    if (String(name).toLowerCase() === 'content-type') {
      return originalSetHeader('Content-Type', LOCK_CONTENT_TYPE);
    }
    return originalSetHeader(name, value);
  }) as ServerResponse['setHeader'];
  res.setHeader('Content-Type', LOCK_CONTENT_TYPE);
}

export function lockFileMiddleware(
  req: IncomingMessage,
  res: ServerResponse,
  next: (err?: unknown) => void,
): void {
  const url = (req as RequestWithOriginalUrl).originalUrl || req.url;
  if (isLockPath(url)) {
    pinLockFileContentType(res);
  }
  next();
}

export function registerLockFileMime(expressStatic: {
  mime?: { define?: (mapping: Record<string, string[]>) => void };
}): void {
  expressStatic.mime?.define?.({ 'text/plain': ['lock'] });
}
