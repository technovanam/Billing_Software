import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import "./index.css";
import Lenis from "lenis";

// Initialise Lenis for site-wide smooth scrolling
const lenis = new Lenis({
  duration: 1.2,
  easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  smooth: true,
  prevent: (node) =>
    node?.hasAttribute?.("data-lenis-prevent") ||
    Boolean(node?.closest?.("[data-lenis-prevent]")),
});

function raf(time) {
  lenis.raf(time);
  requestAnimationFrame(raf);
}
requestAnimationFrame(raf);

// Expose lenis globally so components can call lenis.scrollTo()
window.__lenis = lenis;

createRoot(document.getElementById("root")).render(
  <AuthProvider>
    <App />
  </AuthProvider>
);
