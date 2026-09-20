// Vite preserves the incoming Host while proxying /api to the loopback backend.
// Accept any playtest hostname, but require browser requests to be same-host.
export function allowedOrigin(
  origin: string | undefined,
  host: string | undefined,
  port: number,
) {
  if (!origin) return true;
  if (
    [
      "http://127.0.0.1:5173",
      "http://localhost:5173",
      `http://127.0.0.1:${port}`,
    ].includes(origin)
  )
    return true;
  try {
    const url = new URL(origin);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      url.origin === origin &&
      url.host.toLowerCase() === host?.toLowerCase()
    );
  } catch {
    return false;
  }
}
