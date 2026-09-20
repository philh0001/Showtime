const LEGACY_HOSTNAME = "showtime-web.showtime-workers.workers.dev";
const CANONICAL_HOSTNAME = "showtimetracker.show";

type Env = {
  ASSETS: { fetch(request: Request): Promise<Response> };
};

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.hostname === LEGACY_HOSTNAME) {
      url.protocol = "https:";
      url.hostname = CANONICAL_HOSTNAME;
      url.port = "";
      return Promise.resolve(Response.redirect(url.toString(), 301));
    }
    return env.ASSETS.fetch(request);
  },
};
