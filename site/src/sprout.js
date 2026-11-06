// The ikada docs app: every request is a file from the Astro build (env.ASSETS). Visitors reach
// it at sproutboat.com/ikada, where the sproutboat.com sprout forwards /ikada and /ikada/* here
// over a service binding; it also answers on its own hostname.
export default {
  fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/" || url.pathname === "/ikada") {
      return new Response(null, { status: 308, headers: { location: "/ikada/" } });
    }
    return env.ASSETS.fetch(request);
  },
};
