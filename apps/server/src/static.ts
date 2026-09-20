import { readFile, realpath, stat } from "node:fs/promises";
import { resolve, relative, extname, isAbsolute } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
const TYPES: Record<string, string> = {
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".glb": "model/gltf-binary",
  ".wav": "audio/wav",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};
export async function serveStatic(
  req: IncomingMessage,
  res: ServerResponse,
  root: string,
) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405);
    res.end();
    return;
  }
  try {
    const pathname = decodeURIComponent(
      new URL(req.url ?? "/", "http://local").pathname,
    );
    if (
      pathname.includes("\\") ||
      pathname.split("/").some((p) => p.startsWith("."))
    )
      throw Error();
    const base = await realpath(root);
    const file = await realpath(
      resolve(base, pathname === "/" ? "index.html" : "." + pathname),
    );
    const rel = relative(base, file);
    if (rel.startsWith("..") || isAbsolute(rel) || !(await stat(file)).isFile())
      throw Error();
    const data = await readFile(file);
    res.writeHead(200, {
      "Content-Type": TYPES[extname(file)] ?? "application/octet-stream",
      "Content-Length": data.length,
    });
    res.end(req.method === "HEAD" ? undefined : data);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}
