export default {
  async fetch(): Promise<Response> {
    return new Response("Showtime API is live");
  },
};
