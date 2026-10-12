'use client';

import { useEffect, useState } from 'react';

/**
 * Frames per second that the browser is actually painting.
 *
 * A requestAnimationFrame loop counts frames. The loop itself only counts, and
 * React state is set once a second, so measuring FPS does not add a re-render
 * to every frame (which would lower the number being measured).
 */
export function useFps(): number {
  const [fps, setFps] = useState(0);

  useEffect(() => {
    let frames = 0;
    let windowStart = performance.now();
    let frameId = 0;

    // `now` is the frame's timestamp in milliseconds, passed in by the browser.
    const onFrame = (now: number) => {
      frames += 1;
      const elapsed = now - windowStart;
      if (elapsed >= 1000) {
        setFps(Math.round((frames * 1000) / elapsed));
        frames = 0;
        windowStart = now;
      }
      frameId = requestAnimationFrame(onFrame);
    };
    frameId = requestAnimationFrame(onFrame);

    return () => cancelAnimationFrame(frameId);
  }, []);

  return fps;
}
