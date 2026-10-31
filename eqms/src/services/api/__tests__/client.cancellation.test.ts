import { afterEach, expect, it, vi } from "vitest";
import axios, { type AxiosAdapter, type AxiosResponse } from "axios";
import apiClient, { api } from "../client";

const originalAdapter = apiClient.defaults.adapter;
afterEach(() => { apiClient.defaults.adapter = originalAdapter; });

it("does not reuse an aborted GET when an effect immediately starts the same query again", async () => {
  const controller = new AbortController();
  const adapter = vi.fn<AxiosAdapter>(async (config) => ({ data: { data: [{ id: "degree-1", name: "Bachelor" }] }, status: 200, statusText: "OK", headers: {}, config }));
  apiClient.defaults.adapter = adapter;
  const first = api.get("/settings/education/degree-levels/page", { params: { page: 1 }, signal: controller.signal });
  const firstResult = first.catch((error) => error);
  controller.abort();
  const second = await api.get<{ data: Array<{ id: string }> }>("/settings/education/degree-levels/page", { params: { page: 1 }, signal: new AbortController().signal });
  expect(axios.isCancel(await firstResult)).toBe(true);
  expect(second.data.data[0].id).toBe("degree-1");
});

it("gives concurrent consumers independent cancellation and does not cache their response", async () => {
  const requests: Array<{ resolve: (response: AxiosResponse) => void; config: any }> = [];
  apiClient.defaults.adapter = (config) => new Promise((resolve) => requests.push({ resolve, config }));
  const a = new AbortController(), b = new AbortController();
  const first = api.get("/cancel-test-independent", { signal: a.signal }).catch((error) => error);
  const second = api.get("/cancel-test-independent", { signal: b.signal });
  await vi.waitFor(() => expect(requests).toHaveLength(2));
  a.abort();
  for (const request of requests) request.resolve({ data: "fresh", status: 200, statusText: "OK", headers: {}, config: request.config });
  expect(axios.isCancel(await first)).toBe(true);expect((await second).data).toBe("fresh");
  const third = api.get("/cancel-test-independent", { signal: new AbortController().signal });
  await vi.waitFor(() => expect(requests).toHaveLength(3));
  requests[2].resolve({ data: "new", status: 200, statusText: "OK", headers: {}, config: requests[2].config });
  expect((await third).data).toBe("new");
});

it("preserves request deduplication for consumers that do not own a cancellation signal", async () => {
  let finish!: (value: AxiosResponse) => void; let config: any;
  const adapter = vi.fn<AxiosAdapter>((value) => { config = value; return new Promise((resolve) => { finish = resolve; }); });
  apiClient.defaults.adapter = adapter;
  const first = api.get("/cancel-test-shared"), second = api.get("/cancel-test-shared");
  await vi.waitFor(() => expect(adapter).toHaveBeenCalledTimes(1));
  finish({ data: "shared", status: 200, statusText: "OK", headers: {}, config });
  expect((await first).data).toBe("shared");expect((await second).data).toBe("shared");
});
