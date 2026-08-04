import { subscribeToProductChanges } from "@/lib/product-events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const encoder = new TextEncoder();

export async function GET(request: Request) {
  let cleanup = () => {};

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;

      const send = (message: string) => {
        if (!closed) controller.enqueue(encoder.encode(message));
      };
      const unsubscribe = subscribeToProductChanges((event) => {
        if (event.type === "changed") {
          send(`event: products-changed\ndata: ${Date.now()}\n\n`);
          return;
        }
        if (event.type === "batch-saved") {
          send(`event: products-batch\ndata: ${JSON.stringify(event)}\n\n`);
          return;
        }
        send(`event: products-import-finished\ndata: ${JSON.stringify(event)}\n\n`);
      });
      const heartbeat = setInterval(() => send(": heartbeat\n\n"), 20_000);

      cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        unsubscribe();
        request.signal.removeEventListener("abort", cleanup);
        try {
          controller.close();
        } catch {
          // The stream may already have been closed by the browser.
        }
      };

      request.signal.addEventListener("abort", cleanup, { once: true });
      send("retry: 2000\n: connected\n\n");
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream; charset=utf-8",
      "X-Accel-Buffering": "no",
    },
  });
}
