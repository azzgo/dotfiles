/**
 * Bounded-concurrency scheduler for run_code sub-calls.
 *
 * A FIFO task pool: tasks start strictly in submission order and up to
 * `limit` tasks run concurrently (default 10). This gives a program's
 * `Promise.all([...])` real overlap across independent calls while bounding
 * in-flight host-side tool executions.
 */
export class TaskPool {
	private limit: number;
	private active = 0;
	private queue: Array<{ task: () => Promise<void> }> = [];

	constructor(limit: number) {
		this.limit = Math.max(1, Math.floor(limit) || 1);
	}

	/** Enqueue a task. Returns a promise that settles when the task runs. */
	run<T>(fn: () => Promise<T>): Promise<T> {
		return new Promise<T>((resolve, reject) => {
			const task = async () => {
				try {
					resolve(await fn());
				} catch (err) {
					reject(err);
				} finally {
					this.active--;
					this.pump();
				}
			};
			this.queue.push({ task });
			this.pump();
		});
	}

	private pump(): void {
		while (this.active < this.limit && this.queue.length > 0) {
			const entry = this.queue.shift();
			if (!entry) break;
			this.active++;
			entry.task();
		}
	}
}
