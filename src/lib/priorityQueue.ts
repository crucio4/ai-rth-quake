// ============================================================================
// DEPREM-AI — Faz 1: Priority Queue (Min-Heap by priority descending)
// ============================================================================

import { ScannedBuilding } from './types';

/**
 * Max-heap priority queue: highest priorityScore comes out first.
 */
export class PriorityQueue {
  private heap: ScannedBuilding[] = [];

  get size(): number {
    return this.heap.length;
  }

  get isEmpty(): boolean {
    return this.heap.length === 0;
  }

  /** Insert a building into the queue */
  push(building: ScannedBuilding): void {
    this.heap.push(building);
    this.bubbleUp(this.heap.length - 1);
  }

  /** Remove and return the highest-priority building */
  pop(): ScannedBuilding | undefined {
    if (this.heap.length === 0) return undefined;
    const top = this.heap[0];
    const last = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this.sinkDown(0);
    }
    return top;
  }

  /** Peek at the highest-priority building without removing */
  peek(): ScannedBuilding | undefined {
    return this.heap[0];
  }

  /** Get all buildings sorted by priority (descending) */
  toSortedArray(): ScannedBuilding[] {
    return [...this.heap].sort((a, b) => b.priorityScore - a.priorityScore);
  }

  // -- Heap internals --

  private bubbleUp(i: number): void {
    while (i > 0) {
      const parent = Math.floor((i - 1) / 2);
      if (this.heap[i].priorityScore > this.heap[parent].priorityScore) {
        [this.heap[i], this.heap[parent]] = [this.heap[parent], this.heap[i]];
        i = parent;
      } else break;
    }
  }

  private sinkDown(i: number): void {
    const n = this.heap.length;
    while (true) {
      let largest = i;
      const left = 2 * i + 1;
      const right = 2 * i + 2;
      if (left < n && this.heap[left].priorityScore > this.heap[largest].priorityScore)
        largest = left;
      if (right < n && this.heap[right].priorityScore > this.heap[largest].priorityScore)
        largest = right;
      if (largest !== i) {
        [this.heap[i], this.heap[largest]] = [this.heap[largest], this.heap[i]];
        i = largest;
      } else break;
    }
  }
}
