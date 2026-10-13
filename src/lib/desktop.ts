/** True only in the Windows desktop build (compile-time flag). */
export const isDesktopApp = import.meta.env.VITE_DESKTOP === "true";
