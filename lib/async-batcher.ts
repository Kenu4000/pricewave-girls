type PendingItem<Input, Output> = {
  input: Input;
  resolve: (output: Output) => void;
  reject: (error: unknown) => void;
};

type AsyncBatcherOptions<Input, Output> = {
  maxBatchSize: number;
  flushDelayMs: number;
  processBatch: (inputs: Input[]) => Promise<Output[]>;
};

export class AsyncBatcher<Input, Output> {
  private readonly maxBatchSize: number;
  private readonly flushDelayMs: number;
  private readonly processBatch: (inputs: Input[]) => Promise<Output[]>;
  private pending: Array<PendingItem<Input, Output>> = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private flushing = false;

  constructor(options: AsyncBatcherOptions<Input, Output>) {
    if (!Number.isInteger(options.maxBatchSize) || options.maxBatchSize < 1) {
      throw new Error("maxBatchSizeは1以上の整数で指定してください");
    }
    if (!Number.isFinite(options.flushDelayMs) || options.flushDelayMs < 0) {
      throw new Error("flushDelayMsは0以上で指定してください");
    }

    this.maxBatchSize = options.maxBatchSize;
    this.flushDelayMs = options.flushDelayMs;
    this.processBatch = options.processBatch;
  }

  enqueue(input: Input): Promise<Output> {
    const result = new Promise<Output>((resolve, reject) => {
      this.pending.push({ input, resolve, reject });
    });

    if (this.pending.length >= this.maxBatchSize) {
      this.clearTimer();
      void this.flush();
    } else {
      this.scheduleFlush();
    }

    return result;
  }

  async flushNow(): Promise<void> {
    this.clearTimer();
    await this.flush();
  }

  private scheduleFlush(delayMs = this.flushDelayMs) {
    if (this.timer !== null || this.flushing || this.pending.length === 0) {
      return;
    }

    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, delayMs);
  }

  private clearTimer() {
    if (this.timer === null) return;
    clearTimeout(this.timer);
    this.timer = null;
  }

  private async flush() {
    if (this.flushing || this.pending.length === 0) return;

    this.flushing = true;
    const batch = this.pending.splice(0, this.maxBatchSize);

    try {
      const outputs = await this.processBatch(batch.map((item) => item.input));
      if (outputs.length !== batch.length) {
        throw new Error(
          `バッチ保存の応答件数が一致しません（要求${batch.length}件、応答${outputs.length}件）`,
        );
      }
      batch.forEach((item, index) => item.resolve(outputs[index]));
    } catch (error) {
      batch.forEach((item) => item.reject(error));
    } finally {
      this.flushing = false;
      if (this.pending.length >= this.maxBatchSize) {
        this.scheduleFlush(0);
      } else {
        this.scheduleFlush();
      }
    }
  }
}
