// The reviewer console is loopback-only. Next's internal URL may normalize its
// hostname, so compare Origin to the actual Host header rather than nextUrl.
export function localReviewerOrigin(
  origin: string | null,
  host: string | null,
) {
  if (!origin || !host) return false;
  try {
    const parsed = new URL(origin);
    return (
      parsed.protocol === "http:" &&
      ["127.0.0.1", "localhost", "[::1]"].includes(parsed.hostname) &&
      parsed.host === host &&
      origin === parsed.origin
    );
  } catch {
    return false;
  }
}
