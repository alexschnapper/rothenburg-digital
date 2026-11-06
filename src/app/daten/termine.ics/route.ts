import { icalResponse } from "@/lib/opendata/feedResponse";

/** Termine als iCalendar (#36), Aufbau in `src/lib/opendata/ical.ts`. */
export function GET(request: Request) {
  return icalResponse("termine", request);
}
