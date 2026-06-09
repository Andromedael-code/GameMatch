import { useEffect, useRef, useState } from "react";
import { useStableCallback } from "./useStableCallback";

const SWIPE_THRESHOLD = 120;
const EXIT_DURATION_MS = 460;
const RETURN_DURATION_MS = 420;
const DRAG_X_DAMPING = 0.98;
const DRAG_Y_DAMPING = 0.28;
const EXIT_DISTANCE_VIEWPORT_RATIO = 1.18;
const EXIT_DISTANCE_MIN_PX = 680;
const EXIT_Y_DAMPING = 0.12;

export function useSwipeDeck({ onVote, disabled = false }) {
  const pointerRef = useRef(null);
  const dragRef = useRef({ x: 0, y: 0 });
  const pendingRef = useRef({ x: 0, y: 0, phase: "idle" });
  const frameRef = useRef(0);
  const settleTimeoutRef = useRef(0);
  const swipeTimeoutRef = useRef(0);
  const animatingRef = useRef(false);
  const disabledRef = useRef(disabled);
  const mountedRef = useRef(true);
  const voteEvent = useStableCallback(onVote);
  const [drag, setDrag] = useState({ x: 0, y: 0, phase: "idle" });

  function flushDrag() {
    frameRef.current = 0;
    if (!mountedRef.current) {
      return;
    }

    setDrag(pendingRef.current);
  }

  function scheduleDrag(nextDrag) {
    pendingRef.current = nextDrag;
    if (frameRef.current) {
      return;
    }

    frameRef.current = window.requestAnimationFrame(flushDrag);
  }

  function clearTimers() {
    if (frameRef.current) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = 0;
    }

    if (settleTimeoutRef.current) {
      window.clearTimeout(settleTimeoutRef.current);
      settleTimeoutRef.current = 0;
    }

    if (swipeTimeoutRef.current) {
      window.clearTimeout(swipeTimeoutRef.current);
      swipeTimeoutRef.current = 0;
    }
  }

  function resetImmediately() {
    if (frameRef.current) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = 0;
    }

    const idleDrag = { x: 0, y: 0, phase: "idle" };
    dragRef.current = { x: 0, y: 0 };
    pendingRef.current = idleDrag;
    setDrag(idleDrag);
  }

  function resetCard() {
    clearTimers();
    animatingRef.current = true;
    dragRef.current = { x: 0, y: 0 };
    scheduleDrag({ x: 0, y: 0, phase: "settling" });

    settleTimeoutRef.current = window.setTimeout(() => {
      animatingRef.current = false;
      scheduleDrag({ x: 0, y: 0, phase: "idle" });
    }, RETURN_DURATION_MS);
  }

  function swipe(direction, options = {}) {
    if ((!options.force && disabledRef.current) || animatingRef.current) {
      return false;
    }

    clearTimers();
    animatingRef.current = true;
    pointerRef.current = null;

    const startX = dragRef.current.x;
    const startY = dragRef.current.y;
    const exitDistance = Math.max(window.innerWidth * EXIT_DISTANCE_VIEWPORT_RATIO, EXIT_DISTANCE_MIN_PX);
    const exitX = direction === "like" ? exitDistance : -exitDistance;
    const exitY = startY * EXIT_Y_DAMPING;

    dragRef.current = { x: exitX, y: exitY };
    const exitDrag = { x: exitX, y: exitY, phase: "exit", direction, startX, startY };
    pendingRef.current = exitDrag;
    setDrag(exitDrag);

    swipeTimeoutRef.current = window.setTimeout(() => {
      if (!mountedRef.current) {
        return;
      }

      resetImmediately();
      animatingRef.current = false;
      voteEvent(direction);
    }, EXIT_DURATION_MS);

    return true;
  }

  function handlePointerMove(event) {
    if (!pointerRef.current || disabledRef.current || animatingRef.current) {
      return;
    }

    const deltaX = (event.clientX - pointerRef.current.startX) * DRAG_X_DAMPING;
    const deltaY = (event.clientY - pointerRef.current.startY) * DRAG_Y_DAMPING;

    dragRef.current = { x: deltaX, y: deltaY };
    scheduleDrag({ x: deltaX, y: deltaY, phase: "dragging" });
  }

  function handlePointerUp() {
    if (!pointerRef.current || disabledRef.current || animatingRef.current) {
      return;
    }

    const finalX = dragRef.current.x;
    pointerRef.current = null;

    if (finalX >= SWIPE_THRESHOLD) {
      swipe("like");
      return;
    }

    if (finalX <= -SWIPE_THRESHOLD) {
      swipe("pass");
      return;
    }

    resetCard();
  }

  useEffect(() => {
    disabledRef.current = disabled;
  }, [disabled]);

  useEffect(() => {
    mountedRef.current = true;

    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    return () => {
      mountedRef.current = false;
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
    // Pointer handlers read the latest state through refs, so the listener is intentionally registered once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handlePointerDown(event) {
    const target = event.target;
    const isInteractiveControl =
      target instanceof Element && Boolean(target.closest("button, a, input, select, textarea, label"));

    if (disabledRef.current || animatingRef.current || event.button > 0 || isInteractiveControl) {
      pointerRef.current = null;
      return;
    }

    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture can fail for detached nodes or synthetic events; the window listeners still cover it.
    }

    pointerRef.current = {
      startX: event.clientX,
      startY: event.clientY,
    };

    dragRef.current = { x: 0, y: 0 };
    scheduleDrag({ x: 0, y: 0, phase: "dragging" });
  }

  return {
    drag,
    likeStrength: Math.max(0, drag.x / SWIPE_THRESHOLD),
    passStrength: Math.max(0, (drag.x * -1) / SWIPE_THRESHOLD),
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    triggerSwipe: swipe,
  };
}
