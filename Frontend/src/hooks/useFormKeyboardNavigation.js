import { useEffect } from "react";
import { initFormKeyboardNavigation } from "../utils/keyboardNavigation";

/**
 * Hook to enable global Enter-key form keyboard navigation.
 */
export function useFormKeyboardNavigation() {
  useEffect(() => {
    const cleanup = initFormKeyboardNavigation();
    return cleanup;
  }, []);
}

export default useFormKeyboardNavigation;
