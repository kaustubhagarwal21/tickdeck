import { createRafBatcher } from '../rafBatcher';

/**
 * A fake requestAnimationFrame. Callbacks wait until the test calls
 * runFrame(), so the test decides exactly when a frame happens.
 */
function fakeFrames() {
  const pending = new Map<number, () => void>();
  let nextHandle = 1;
  return {
    schedule: jest.fn((callback: () => void) => {
      const handle = nextHandle++;
      pending.set(handle, callback);
      return handle;
    }),
    cancel: jest.fn((handle: number) => {
      pending.delete(handle);
    }),
    runFrame() {
      const callbacks = [...pending.values()];
      pending.clear();
      callbacks.forEach((callback) => callback());
    },
  };
}

describe('createRafBatcher', () => {
  it('turns any number of pushes in one frame into a single flush, in push order', () => {
    const frames = fakeFrames();
    const flush = jest.fn();
    const batcher = createRafBatcher<number>(flush, frames.schedule, frames.cancel);

    for (let i = 0; i < 500; i++) batcher.push(i);

    expect(frames.schedule).toHaveBeenCalledTimes(1); // one frame requested, not 500
    expect(flush).not.toHaveBeenCalled(); // nothing happens until the frame

    frames.runFrame();

    expect(flush).toHaveBeenCalledTimes(1);
    expect(flush).toHaveBeenCalledWith(Array.from({ length: 500 }, (_, i) => i));
  });

  it('starts a new batch after each flush', () => {
    const frames = fakeFrames();
    const flush = jest.fn();
    const batcher = createRafBatcher<string>(flush, frames.schedule, frames.cancel);

    batcher.push('a');
    batcher.push('b');
    frames.runFrame();
    batcher.push('c');
    frames.runFrame();

    expect(flush.mock.calls).toEqual([[['a', 'b']], [['c']]]);
    expect(frames.schedule).toHaveBeenCalledTimes(2);
  });

  it('does not schedule or flush when nothing was pushed', () => {
    const frames = fakeFrames();
    const flush = jest.fn();
    createRafBatcher<number>(flush, frames.schedule, frames.cancel);

    frames.runFrame();

    expect(frames.schedule).not.toHaveBeenCalled();
    expect(flush).not.toHaveBeenCalled();
  });

  it('on dispose, cancels the pending frame, drops queued items and ignores later pushes', () => {
    const frames = fakeFrames();
    const flush = jest.fn();
    const batcher = createRafBatcher<number>(flush, frames.schedule, frames.cancel);

    batcher.push(1);
    batcher.push(2);
    batcher.dispose();
    frames.runFrame();
    batcher.push(3);
    frames.runFrame();

    expect(frames.cancel).toHaveBeenCalledWith(1); // the handle of the scheduled frame
    expect(frames.schedule).toHaveBeenCalledTimes(1);
    expect(flush).not.toHaveBeenCalled();
  });

  it('flushes at once when the queue reaches maxQueue, because hidden tabs get no frames', () => {
    const frames = fakeFrames();
    const flush = jest.fn();
    const batcher = createRafBatcher<number>(flush, frames.schedule, frames.cancel, 3);

    batcher.push(1);
    batcher.push(2);
    expect(flush).not.toHaveBeenCalled();

    batcher.push(3);
    expect(flush).toHaveBeenCalledWith([1, 2, 3]);
    expect(frames.cancel).toHaveBeenCalledTimes(1); // the frame is no longer needed

    frames.runFrame();
    expect(flush).toHaveBeenCalledTimes(1);
  });

  it('uses requestAnimationFrame by default', () => {
    jest.useFakeTimers(); // Jest's fake timers include a fake requestAnimationFrame (16 ms frames)
    try {
      const flush = jest.fn();
      const batcher = createRafBatcher<string>(flush);
      batcher.push('x');
      batcher.push('y');

      jest.advanceTimersByTime(16);

      expect(flush).toHaveBeenCalledTimes(1);
      expect(flush).toHaveBeenCalledWith(['x', 'y']);
    } finally {
      jest.useRealTimers();
    }
  });
});
