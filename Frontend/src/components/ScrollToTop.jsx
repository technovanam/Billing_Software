import { useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";

// Let the app decide scroll position on navigation, not the browser.
if (typeof window !== "undefined" && "scrollRestoration" in window.history) {
  window.history.scrollRestoration = "manual";
}

export default function ScrollToTop() {
  const { pathname } = useLocation();

  useLayoutEffect(() => {
    // Lenis keeps its own scroll position; jump it too, or it animates back
    // to where the previous page was scrolled.
    const lenis = window.__lenis;
    if (lenis) {
      lenis.resize?.();
      lenis.scrollTo(0, { immediate: true, force: true });
    }
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
