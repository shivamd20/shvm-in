import { describe, it, expect } from "vitest";
import { RingBuffer } from "../server/ring-buffer";

function buf(n: number): ArrayBuffer {
  const a = new Uint8Array(1);
  a[0] = n;
  return a.buffer;
}

describe("RingBuffer", () => {
  it("stores chunks in order", () => {
    const rb = new RingBuffer(10);
    rb.push(buf(1));
    rb.push(buf(2));
    const out = rb.takeAll();
    expect(out.length).toBe(2);
    expect(new Uint8Array(out[0])[0]).toBe(1);
    expect(new Uint8Array(out[1])[0]).toBe(2);
  });

  it("takeAll clears buffer", () => {
    const rb = new RingBuffer(10);
    rb.push(buf(1));
    rb.takeAll();
    expect(rb.length).toBe(0);
    expect(rb.takeAll().length).toBe(0);
  });

  it("respects capacity and drops oldest when full", () => {
    const rb = new RingBuffer(3);
    rb.push(buf(1));
    rb.push(buf(2));
    rb.push(buf(3));
    expect(rb.length).toBe(3);
    rb.push(buf(4)); // drop 1
    expect(rb.length).toBe(3);
    const out = rb.takeAll();
    expect(out.length).toBe(3);
    expect(new Uint8Array(out[0])[0]).toBe(2);
    expect(new Uint8Array(out[1])[0]).toBe(3);
    expect(new Uint8Array(out[2])[0]).toBe(4);
  });

  it("no unbounded growth", () => {
    const rb = new RingBuffer(2);
    for (let i = 0; i < 100; i++) rb.push(buf(i));
    expect(rb.length).toBe(2);
    const out = rb.takeAll();
    expect(new Uint8Array(out[0])[0]).toBe(98);
    expect(new Uint8Array(out[1])[0]).toBe(99);
  });

  it("byteLength reflects stored bytes", () => {
    const rb = new RingBuffer(5);
    rb.push(buf(1));
    rb.push(buf(2));
    expect(rb.byteLength).toBe(2);
    rb.takeAll();
    expect(rb.byteLength).toBe(0);
  });

  it("throws if capacity < 1", () => {
    expect(() => new RingBuffer(0)).toThrow("capacity must be >= 1");
  });

  it("push after takeAll works", () => {
    const rb = new RingBuffer(5);
    rb.push(buf(1));
    rb.takeAll();
    rb.push(buf(2));
    const out = rb.takeAll();
    expect(out.length).toBe(1);
    expect(new Uint8Array(out[0])[0]).toBe(2);
  });

  it("takeAll when empty returns empty array", () => {
    const rb = new RingBuffer(3);
    expect(rb.takeAll()).toEqual([]);
    expect(rb.takeAll()).toEqual([]);
  });
});
