export const DEFAULT_VOICE_SERVER_URL = "https://shvm.in";

export function buildVoiceWebSocketUrl({
  sessionId,
  serverUrl,
  wsPath,
  getWebSocketUrlOverride,
}: {
  sessionId: string;
  serverUrl?: string;
  wsPath?: (sessionId: string) => string;
  getWebSocketUrlOverride?: (sessionId: string) => string;
}) {
  if (getWebSocketUrlOverride) return getWebSocketUrlOverride(sessionId);

  const wsPathValue = wsPath ? wsPath(sessionId) : `/ws/${sessionId}`;
  const base = new URL(serverUrl ?? DEFAULT_VOICE_SERVER_URL);
  const protocol =
    base.protocol === "https:" ? "wss:" : base.protocol === "http:" ? "ws:" : base.protocol;
  base.protocol = protocol;
  return new URL(wsPathValue, base).toString();
}

