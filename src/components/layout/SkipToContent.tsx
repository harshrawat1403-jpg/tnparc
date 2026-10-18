import React from "react";

/**
 * SkipToContent Component
 *
 * WCAG 2.1 AA requirement: Must be the very first focusable element
 * in the DOM to allow keyboard and screen-reader users to bypass repetitive header navigation.
 */
export const SkipToContent: React.FC = () => {
  return (
    <a href="#main-content" className="skip-link">
      Skip to main content
    </a>
  );
};
