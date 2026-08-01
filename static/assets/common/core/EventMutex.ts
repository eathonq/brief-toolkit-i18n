/**
 * EventMutex.ts - 事件互斥锁
 * @description 该类用于限制事件的最大并发量，确保在高并发场景下的顺序执行。
 *
 * @author vangagh@live.cn
 * @license MIT
 * @version v1.0.0
 *
 * @created 2023-02-28
 * @modified 2026-03-12
 */

/**
 * 事件互斥锁，用于限制事件的最大并发量。
 * 例如：限制最大并发量为1，那么当事件正在执行时，后续的事件将会被阻塞，直到事件执行完毕。
 * @example
 * let eventMutex = new EventMutex();
 * // 顺序执行
 * let result = [];
 * for (let i = 0; i < 10; i++) {
 *    await eventMutex.wait();
 *    result.push(i);
 *    eventMutex.notify();
 * }
 */
export class EventMutex {
  private _queue: (() => void)[] = [];
  private _activeCount = 0; // 当前活跃的任务数
  private _maxConcurrency: number;

  /**
   * 构造函数
   * @param maxConcurrency 最大并发量，默认1
   */
  constructor(maxConcurrency = 1) {
    if (maxConcurrency < 1) {
      throw new Error('maxConcurrency must be at least 1');
    }
    this._maxConcurrency = maxConcurrency;
  }

  /** 等待获取执行许可 */
  async wait(): Promise<void> {
    // 如果当前活跃数小于最大并发量，可以直接执行
    if (this._activeCount < this._maxConcurrency) {
      this._activeCount++;
      return;
    }

    // 否则加入等待队列
    await new Promise<void>(resolve => {
      this._queue.push(resolve);
    });
    this._activeCount++;
  }

  /** 通知事件执行完毕，释放一个许可 */
  notify(): void {
    if (this._activeCount <= 0) {
      throw new Error('No active mutex to notify');
    }

    this._activeCount--;

    // 如果有等待的任务，唤醒下一个
    if (this._queue.length > 0) {
      const next = this._queue.shift();
      next?.();
    }
  }

  /** 获取当前等待队列长度 */
  get waitingCount(): number {
    return this._queue.length;
  }

  /** 获取当前活跃任务数 */
  get activeCount(): number {
    return this._activeCount;
  }

  /** 重置互斥锁 */
  reset(): void {
    this._queue = [];
    this._activeCount = 0;
  }
}
