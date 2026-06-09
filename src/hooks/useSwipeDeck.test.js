import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSwipeDeck } from "./useSwipeDeck";

function createPointerDownEvent({ target, button = 0, clientX = 0, clientY = 0 } = {}) {
  return {
    target: target || document.createElement("div"),
    button,
    clientX,
    clientY,
  };
}

describe("useSwipeDeck", () => {
  let frameId;
  let frameTimeouts;

  beforeEach(() => {
    vi.useFakeTimers();
    frameId = 0;
    frameTimeouts = new Map();

    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      const id = (frameId += 1);
      const timeoutId = window.setTimeout(() => {
        frameTimeouts.delete(id);
        callback(performance.now());
      }, 0);
      frameTimeouts.set(id, timeoutId);
      return id;
    });

    vi.spyOn(window, "cancelAnimationFrame").mockImplementation((id) => {
      const timeoutId = frameTimeouts.get(id);
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
      frameTimeouts.delete(id);
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("chama onVote com like ao arrastar para direita acima do threshold", () => {
    const onVote = vi.fn();
    const { result } = renderHook(() => useSwipeDeck({ onVote }));

    act(() => {
      result.current.handlePointerDown(createPointerDownEvent({ clientX: 0, clientY: 0 }));
      result.current.handlePointerMove({ clientX: 180, clientY: 0 });
      result.current.handlePointerUp();
      vi.advanceTimersByTime(460);
    });

    expect(onVote).toHaveBeenCalledWith("like");
  });

  it("chama onVote com pass ao arrastar para esquerda acima do threshold", () => {
    const onVote = vi.fn();
    const { result } = renderHook(() => useSwipeDeck({ onVote }));

    act(() => {
      result.current.handlePointerDown(createPointerDownEvent({ clientX: 0, clientY: 0 }));
      result.current.handlePointerMove({ clientX: -180, clientY: 0 });
      result.current.handlePointerUp();
      vi.advanceTimersByTime(460);
    });

    expect(onVote).toHaveBeenCalledWith("pass");
  });

  it("retorna ao centro quando o swipe fica abaixo do threshold", () => {
    const onVote = vi.fn();
    const { result } = renderHook(() => useSwipeDeck({ onVote }));

    act(() => {
      result.current.handlePointerDown(createPointerDownEvent({ clientX: 0, clientY: 0 }));
      result.current.handlePointerMove({ clientX: 40, clientY: 20 });
      result.current.handlePointerUp();
      vi.advanceTimersByTime(0);
    });

    expect(result.current.drag).toMatchObject({ x: 0, y: 0, phase: "settling" });
    expect(onVote).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(421);
      vi.runOnlyPendingTimers();
    });

    expect(result.current.drag).toMatchObject({ x: 0, y: 0, phase: "idle" });
  });

  it("ignora eventos de pointer quando disabled e true", () => {
    const onVote = vi.fn();
    const { result } = renderHook(() => useSwipeDeck({ onVote, disabled: true }));

    act(() => {
      result.current.handlePointerDown(createPointerDownEvent({ clientX: 0, clientY: 0 }));
      result.current.handlePointerMove({ clientX: 180, clientY: 0 });
      result.current.handlePointerUp();
      vi.advanceTimersByTime(460);
    });

    expect(result.current.drag).toMatchObject({ x: 0, y: 0, phase: "idle" });
    expect(onVote).not.toHaveBeenCalled();
  });

  it("executa triggerSwipe programatico", () => {
    const onVote = vi.fn();
    const { result } = renderHook(() => useSwipeDeck({ onVote }));

    act(() => {
      result.current.triggerSwipe("like");
      vi.advanceTimersByTime(0);
    });

    expect(result.current.drag).toMatchObject({ phase: "exit", direction: "like" });
    expect(result.current.drag.x).toBeGreaterThan(0);
    expect(onVote).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(460);
    });

    expect(onVote).toHaveBeenCalledWith("like");
  });
});
