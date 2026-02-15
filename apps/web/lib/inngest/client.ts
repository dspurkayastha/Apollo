import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "apollo",
  eventKey: process.env.INNGEST_EVENT_KEY,
});
