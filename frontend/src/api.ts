import { createClient } from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-web";
import { TripExpensesService } from "./gen/tripexpenses/v1/tripexpenses_pb";

export const client = createClient(
  TripExpensesService,
  createConnectTransport({ baseUrl: window.location.origin }),
);
