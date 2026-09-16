export type SafeRoute =
  | "search"
  | "discovery"
  | "movie-details"
  | "tv-details"
  | "season-details"
  | "person-details"
  | "unmatched";

export type SafeEvent = {
  requestId: string;
  route: SafeRoute;
  status: number;
  durationMs: number;
  cache: "hit" | "miss" | "bypass";
};

export function logEvent(event: SafeEvent): void {
  console.log(JSON.stringify(event));
}
