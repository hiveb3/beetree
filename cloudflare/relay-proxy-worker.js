// Reverse proxy for the Hive Block Producer relay server (VPS), hiding the origin IP behind Cloudflare.
// Forwards both plain HTTP (login challenge/verify) and WebSocket (versus multiplayer) traffic.
const ORIGIN = "https://169-58-182-112.sslip.io";

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const originUrl = ORIGIN + url.pathname + url.search;

    if (request.headers.get("Upgrade") === "websocket") {
      return fetch(originUrl, request);
    }

    const originRequest = new Request(originUrl, request);
    return fetch(originRequest);
  },
};
