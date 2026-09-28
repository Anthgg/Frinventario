import { StrictMode, createRef, type RefObject } from 'react';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useQrScanner } from '@/features/conteo/useQrScanner';
import { useQrCamera } from '@/features/conteo/useQrCamera';
import type { QrDetection, QrDetector } from '@/features/conteo/qr/detector';

/** rAF controlado a mano: un paso = un cuadro de la página. */
let callbacks: Array<FrameRequestCallback | null> = [];

function step(time: number): void {
  const batch = callbacks;
  callbacks = [];
  for (const callback of batch) callback?.(time);
}

beforeEach(() => {
  callbacks = [];
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callbacks.push(callback);
    return callbacks.length;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    if (callbacks[id - 1]) callbacks[id - 1] = null;
  });
});

function detectorReturning(frames: QrDetection[][]): { detector: QrDetector; detect: ReturnType<typeof vi.fn> } {
  let index = 0;
  const detect = vi.fn(async () => {
    const frame = frames[Math.min(index, frames.length - 1)] ?? [];
    index += 1;
    return frame;
  });
  const detector: QrDetector = { kind: 'fallback', detect, stop: vi.fn() };
  return { detector, detect };
}

function videoRefWithValue(): RefObject<HTMLVideoElement | null> {
  const ref = createRef<HTMLVideoElement | null>();
  ref.current = document.createElement('video');
  return ref;
}

describe('useQrScanner (loop de detección)', () => {
  it('analiza el frame, filtra por región y entrega solo lo aceptado', async () => {
    const region = { x: 10, y: 10, width: 80, height: 80 };
    const { detector, detect } = detectorReturning([
      [{ value: 'REF-1', box: region }],
      [{ value: 'REF-1', box: region }],
      [{ value: 'REF-1', box: region }],
    ]);
    const onAccepted = vi.fn();

    const view = renderHook(() =>
      useQrScanner({ videoRef: videoRefWithValue(), enabled: true, onAccepted, detectorFactory: () => detector }),
    );

    await act(async () => {
      step(1000);
    });
    await act(async () => {
      step(1100);
    });

    expect(detect).toHaveBeenCalledTimes(2);
    // Segundo cuadro: misma región ⇒ no vuelve a aceptar (una sola intención).
    expect(onAccepted).toHaveBeenCalledTimes(1);
    expect(onAccepted.mock.calls[0]![0]).toHaveLength(1);

    view.unmount();
  });

  it('un solo loop aunque el componente monte en StrictMode', async () => {
    const { detector, detect } = detectorReturning([[{ value: 'REF-1', box: null }]]);
    const onAccepted = vi.fn();

    const view = renderHook(
      () =>
        useQrScanner({
          videoRef: videoRefWithValue(),
          enabled: true,
          onAccepted,
          detectorFactory: () => detector,
        }),
      { wrapper: ({ children }) => <StrictMode>{children}</StrictMode> },
    );

    await act(async () => {
      step(1000);
    });

    expect(detect).toHaveBeenCalledTimes(1);
    view.unmount();
  });

  it('al desmontar cancela el loop y detiene el detector (sin fugas)', async () => {
    const { detector, detect } = detectorReturning([[{ value: 'REF-1', box: null }]]);
    const onAccepted = vi.fn();

    const view = renderHook(() =>
      useQrScanner({ videoRef: videoRefWithValue(), enabled: true, onAccepted, detectorFactory: () => detector }),
    );

    await act(async () => {
      step(1000);
    });
    view.unmount();

    const callsBefore = detect.mock.calls.length;
    step(1100);
    step(1200);

    expect(detect).toHaveBeenCalledTimes(callsBefore);
    expect(detector.stop).toHaveBeenCalled();
    expect(callbacks.every((callback) => callback === null)).toBe(true);
  });

  it('no arranca el loop mientras la cámara esté apagada', async () => {
    const { detector, detect } = detectorReturning([[{ value: 'REF-1', box: null }]]);
    const onAccepted = vi.fn();

    renderHook(() =>
      useQrScanner({ videoRef: videoRefWithValue(), enabled: false, onAccepted, detectorFactory: () => detector }),
    );

    step(1000);
    step(1100);

    expect(detect).not.toHaveBeenCalled();
  });
});

describe('useQrCamera (permisos, stream y ciclo de vida)', () => {
  it('abre la cámara con la trasera ideal y libera los tracks al desmontar', async () => {
    const stop = vi.fn();
    const stream = { getTracks: () => [{ stop }] } as unknown as MediaStream;
    const getUserMedia = vi.fn(async () => stream);
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia },
      configurable: true,
    });
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);

    const videoRef = createRef<HTMLVideoElement | null>();
    videoRef.current = document.createElement('video');
    const view = renderHook(() => useQrCamera(videoRef));

    expect(view.result.current.status).toBe('idle');

    await act(async () => {
      await view.result.current.start();
    });

    expect(getUserMedia).toHaveBeenCalledWith({
      video: { facingMode: { ideal: 'environment' } },
      audio: false,
    });
    expect(view.result.current.status).toBe('active');
    expect(videoRef.current?.srcObject).toBe(stream);

    view.unmount();
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('reporta permiso denegado sin romper la vista', async () => {
    const error = Object.assign(new Error('denied'), { name: 'NotAllowedError' });
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: vi.fn(async () => Promise.reject(error)) },
      configurable: true,
    });

    const view = renderHook(() => useQrCamera(createRef<HTMLVideoElement | null>()));

    await act(async () => {
      await view.result.current.start();
    });

    expect(view.result.current.status).toBe('error');
    expect(view.result.current.error?.kind).toBe('denied');
  });
});
