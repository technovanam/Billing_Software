import { useCallback, useEffect, useState } from "react";

// Set when the cashier deliberately leaves fullscreen, so we stop forcing it back
const OPT_OUT_KEY = "pos_fullscreen_opt_out";

const getFullscreenElement = () =>
  document.fullscreenElement || document.webkitFullscreenElement || null;

// Installed POS app launched with display "fullscreen" (no browser chrome at all)
const isAppFullscreen = () =>
  window.matchMedia?.("(display-mode: fullscreen)").matches ?? false;

export const enterPOSFullscreen = async () => {
  if (getFullscreenElement() || isAppFullscreen()) return;
  const el = document.documentElement;
  const request = el.requestFullscreen || el.webkitRequestFullscreen;
  if (!request) return;
  try {
    await request.call(el, { navigationUI: "hide" });
  } catch {
    // Browsers reject this without a recent user gesture; the next click/key retries
  }
};

export const exitPOSFullscreen = async () => {
  if (!getFullscreenElement()) return;
  const exit = document.exitFullscreen || document.webkitExitFullscreen;
  try {
    await exit?.call(document);
  } catch {
    // Already exited
  }
};

// Keeps the POS terminal in fullscreen like a dedicated billing machine.
// Browsers only allow fullscreen after a user gesture, so if the first attempt is
// blocked (e.g. after a page reload) the cashier's next click or key press enters it.
export default function usePOSFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(
    () => Boolean(getFullscreenElement()) || isAppFullscreen()
  );

  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(getFullscreenElement()) || isAppFullscreen());
    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("webkitfullscreenchange", onChange);

    const optedOut = () => sessionStorage.getItem(OPT_OUT_KEY) === "1";
    const onGesture = () => {
      if (!optedOut()) enterPOSFullscreen();
    };

    if (!optedOut()) enterPOSFullscreen();
    window.addEventListener("pointerdown", onGesture, true);
    window.addEventListener("keydown", onGesture, true);

    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("webkitfullscreenchange", onChange);
      window.removeEventListener("pointerdown", onGesture, true);
      window.removeEventListener("keydown", onGesture, true);
    };
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (getFullscreenElement()) {
      sessionStorage.setItem(OPT_OUT_KEY, "1");
      exitPOSFullscreen();
    } else {
      sessionStorage.removeItem(OPT_OUT_KEY);
      enterPOSFullscreen();
    }
  }, []);

  // The installed app is already fullscreen by its manifest, so a toggle would do nothing there
  return { isFullscreen, toggleFullscreen, canToggle: !isAppFullscreen() };
}
