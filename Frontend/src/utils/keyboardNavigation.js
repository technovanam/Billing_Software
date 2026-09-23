/**
 * Universal Form Keyboard Navigation Utility
 * Enables fast Enter-key navigation across all form fields in the application.
 */

// Selectors for form fields that participate in keyboard navigation
const FIELD_SELECTORS = [
  'input:not([type="hidden"]):not([type="submit"]):not([type="reset"]):not([type="button"]):not([type="image"])',
  'select',
  'textarea',
  'button[role="switch"]',
  'button[data-form-toggle="true"]',
  '[data-form-field="true"]',
].join(", ");

/**
 * Check if an element is visible and interactive
 */
export function isElementNavigable(el) {
  if (!el || !(el instanceof HTMLElement)) return false;

  // Skip disabled or aria-disabled
  if (el.disabled || el.getAttribute("aria-disabled") === "true") return false;

  // Skip read-only fields (e.g. calculated totals/amounts, non-editable code)
  if (el.readOnly || el.hasAttribute("readonly") || el.getAttribute("aria-readonly") === "true") {
    return false;
  }

  // Skip hidden input types or hidden attributes
  if (el.tagName === "INPUT" && el.type === "hidden") return false;
  if (el.hasAttribute("hidden")) return false;

  // Check visibility and dimensions
  if (el.getClientRects().length === 0) return false;

  const style = window.getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
    return false;
  }

  // Skip elements marked explicitly to skip enter navigation
  if (el.dataset.skipEnter === "true" || el.hasAttribute("data-skip-form-nav")) {
    return false;
  }

  // Skip tabIndex = -1
  if (el.getAttribute("tabindex") === "-1") return false;

  // If it's a button, only allow explicit toggle/switch buttons
  if (el.tagName === "BUTTON") {
    const isSwitch = el.getAttribute("role") === "switch" || el.dataset.formToggle === "true" || el.dataset.formField === "true";
    if (!isSwitch) return false;
  }

  return true;
}

/**
 * Find the closest logical form or dialog container
 */
export function getFormContainer(element) {
  if (!element || !(element instanceof HTMLElement)) return document.body;

  // 1. Check for closest explicit form or modal dialog
  const container = element.closest('form, [data-form-container="true"], [role="dialog"], .modal, .modal-content');
  if (container) return container;

  // 2. Check for closest card or section with multiple inputs
  const cardSection = element.closest('.bg-white, .rounded-xl, .rounded-lg, section, article');
  if (cardSection && cardSection.querySelectorAll(FIELD_SELECTORS).length > 1) {
    // If inside a main content container, use the main content container to allow cross-section navigation
    const mainContainer = element.closest('main, [role="main"], #root');
    if (mainContainer) return mainContainer;
    return cardSection;
  }

  // 3. Fallback to main or body
  const main = element.closest('main, [role="main"], #root');
  return main || document.body;
}

/**
 * Get all valid navigable form fields within a container in DOM order
 */
export function getNavigableFormFields(container) {
  if (!container) return [];
  const rawElements = Array.from(container.querySelectorAll(FIELD_SELECTORS));
  return rawElements.filter(isElementNavigable);
}

/**
 * Focus an element and select text if applicable
 */
export function focusFormField(el) {
  if (!el || typeof el.focus !== "function") return false;

  try {
    el.focus({ preventScroll: false });

    // Select text for inputs where selection makes sense (rapid replacement)
    if (
      el.tagName === "INPUT" &&
      typeof el.select === "function" &&
      !["date", "datetime-local", "time", "month", "week", "checkbox", "radio", "color", "file"].includes(el.type)
    ) {
      el.select();
    }

    // Smoothly scroll into view if necessary
    el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
    return true;
  } catch (err) {
    console.warn("Could not focus form field:", err);
    return false;
  }
}

/**
 * Focus the next navigable form field from the given element
 */
export function focusNextFormField(currentElement) {
  if (!currentElement) return false;

  const container = getFormContainer(currentElement);
  const fields = getNavigableFormFields(container);

  const currentIndex = fields.indexOf(currentElement);

  if (currentIndex !== -1 && currentIndex < fields.length - 1) {
    const nextField = fields[currentIndex + 1];
    return focusFormField(nextField);
  }

  // If container didn't have next field (e.g. inside a nested container), try searching from the page main
  if (container !== document.body) {
    const mainContainer = currentElement.closest('main, #root') || document.body;
    const globalFields = getNavigableFormFields(mainContainer);
    const globalIndex = globalFields.indexOf(currentElement);

    if (globalIndex !== -1 && globalIndex < globalFields.length - 1) {
      const nextGlobalField = globalFields[globalIndex + 1];
      return focusFormField(nextGlobalField);
    }
  }

  return false;
}

/**
 * Focus the previous navigable form field
 */
export function focusPreviousFormField(currentElement) {
  if (!currentElement) return false;

  const container = getFormContainer(currentElement);
  const fields = getNavigableFormFields(container);

  const currentIndex = fields.indexOf(currentElement);

  if (currentIndex > 0) {
    const prevField = fields[currentIndex - 1];
    return focusFormField(prevField);
  }

  return false;
}

/**
 * Handles global keydown events for Enter key navigation
 */
function handleKeyDown(event) {
  // Only handle 'Enter' key
  if (event.key !== "Enter") return;

  // Ignore composing IME (e.g. Chinese/Japanese IME)
  if (event.isComposing) return;

  // Ignore if modified with Ctrl or Meta or Alt
  if (event.ctrlKey || event.metaKey || event.altKey) return;

  const target = event.target;
  if (!target || !(target instanceof HTMLElement)) return;

  // Check if target is inside an AI Assistant chat or general chat input
  if (
    target.closest('[data-chat-input="true"], .ai-chat-input, form.chat-input-form, .chat-box')
  ) {
    // Let normal chat form submit on Enter
    return;
  }

  // Check for TEXTAREA
  if (target.tagName === "TEXTAREA") {
    // Normal multi-line textareas keep standard Enter behavior (new line)
    // Only navigate on Enter if explicitly configured as single-line field
    const isSingleLine = target.dataset.singleLine === "true" || target.classList.contains("single-line-field");
    if (!isSingleLine) {
      return;
    }
  }

  // If target is a standard button (other than toggle/switch) that was focused intentionally, allow normal click
  if (target.tagName === "BUTTON") {
    const isSwitch = target.getAttribute("role") === "switch" || target.dataset.formToggle === "true" || target.dataset.formField === "true";
    if (!isSwitch) {
      return;
    }
    // If it is a switch, toggle it on Enter and move to next field
    target.click();
    event.preventDefault();
    focusNextFormField(target);
    return;
  }

  // Check if target is a navigable form field (input, select, checkbox, etc.)
  const isInputField =
    target.tagName === "INPUT" ||
    target.tagName === "SELECT" ||
    target.tagName === "TEXTAREA" ||
    target.dataset.formField === "true";

  if (!isInputField) return;

  // If the target has an active custom dropdown (like autocomplete suggestions), let autocomplete handle selection
  if (target.dataset.autocompleteOpen === "true") {
    return;
  }

  // Prevent default form submission on Enter in an input field
  event.preventDefault();
  event.stopPropagation();

  // If checkbox or radio, space toggles, Enter moves to next
  focusNextFormField(target);
}

/**
 * Ensures all date inputs in the document are constrained to 4-digit years (max 9999-12-31)
 */
function handleDateInputFix(event) {
  const target = event.target;
  if (!target || !(target instanceof HTMLInputElement) || target.type !== "date") return;

  if (!target.hasAttribute("max")) {
    target.setAttribute("max", "9999-12-31");
  }

  if (target.value) {
    const parts = target.value.split("-");
    if (parts.length >= 1 && parts[0].length > 4) {
      parts[0] = parts[0].slice(0, 4);
      target.value = parts.join("-");
    }
  }
}

/**
 * Initialize global form keyboard navigation & date constraint listeners
 */
export function initFormKeyboardNavigation() {
  if (typeof window === "undefined") return () => {};

  // Attach keydown listener in capture phase to reliably intercept Enter before default form actions
  document.addEventListener("keydown", handleKeyDown, true);

  // Enforce 4-digit year on date inputs across the application
  document.addEventListener("focusin", handleDateInputFix, true);
  document.addEventListener("input", handleDateInputFix, true);
  document.addEventListener("change", handleDateInputFix, true);

  // Apply max="9999-12-31" to any existing date inputs on page
  document.querySelectorAll('input[type="date"]').forEach((input) => {
    if (!input.hasAttribute("max")) {
      input.setAttribute("max", "9999-12-31");
    }
  });

  return () => {
    document.removeEventListener("keydown", handleKeyDown, true);
    document.removeEventListener("focusin", handleDateInputFix, true);
    document.removeEventListener("input", handleDateInputFix, true);
    document.removeEventListener("change", handleDateInputFix, true);
  };
}

