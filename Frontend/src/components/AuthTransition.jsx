import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import SignIn from "../pages/auth/SignIn";
import SignUp from "../pages/auth/SignUp";

const DURATION_MS = 700;
const EASING = "cubic-bezier(0.25, 0.46, 0.45, 0.94)";

export default function AuthTransition() {
  const location = useLocation();
  const isSignUp = location.pathname === "/signup";
  const [isReady, setIsReady] = useState(false);
  const [transitionDone, setTransitionDone] = useState(false);

  useEffect(() => {
    setIsReady(false);
    setTransitionDone(false);
    let doneTimeout;
    const rafId = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTimeout(() => setIsReady(true), 20);
        doneTimeout = setTimeout(() => setTransitionDone(true), DURATION_MS + 50);
      });
    });
    return () => {
      cancelAnimationFrame(rafId);
      if (doneTimeout) clearTimeout(doneTimeout);
    };
  }, [location.pathname]);

  const fromRight = isSignUp;
  const translateX = isReady ? 0 : fromRight ? 100 : -100;

  return (
    <div className="w-full min-h-screen">
      <div
        className="w-full min-h-screen"
        style={{
          transform: transitionDone ? "none" : `translateX(${translateX}%)`,
          opacity: isReady ? 1 : 0.92,
          transition: transitionDone
            ? "none"
            : `transform ${DURATION_MS}ms ${EASING}, opacity ${DURATION_MS}ms ${EASING}`,
          willChange: transitionDone ? "auto" : "transform",
        }}
      >
        {isSignUp ? <SignUp /> : <SignIn />}
      </div>
    </div>
  );
}
