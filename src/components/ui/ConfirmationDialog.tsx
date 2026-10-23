"use client";

import React, { useEffect, useRef } from "react";
import { Heading } from "./Heading";
import { Text } from "./Text";
import { Button } from "./Button";

export interface ConfirmationDialogProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "primary";
  isPending?: boolean;
  children?: React.ReactNode;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export function ConfirmationDialog({
  isOpen,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
  isPending = false,
  children,
  onConfirm,
  onCancel,
}: ConfirmationDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  // Store active element on open and restore on close
  useEffect(() => {
    if (isOpen) {
      previousActiveElementRef.current =
        document.activeElement as HTMLElement | null;
      const timer = setTimeout(() => {
        confirmBtnRef.current?.focus();
      }, 50);

      return () => {
        clearTimeout(timer);
        if (
          previousActiveElementRef.current &&
          typeof previousActiveElementRef.current.focus === "function"
        ) {
          previousActiveElementRef.current.focus();
        }
      };
    }
  }, [isOpen]);

  // Handle Tab focus trapping and Escape key
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (!isPending) {
          onCancel();
        }
        return;
      }

      if (event.key === "Tab") {
        if (!dialogRef.current) return;
        const focusableElements =
          dialogRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          );

        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (!firstElement || !lastElement) return;

        if (event.shiftKey) {
          if (document.activeElement === firstElement) {
            event.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            event.preventDefault();
            firstElement.focus();
          }
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isPending, onCancel]);

  if (!isOpen) return null;

  const confirmButtonVariant = variant === "danger" ? "destructive" : "primary";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-sm"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-desc"
    >
      <div
        ref={dialogRef}
        className="relative w-full max-w-md p-6 bg-white border border-neutral-200 rounded-lg shadow-xl"
      >
        <div className="mb-4">
          <Heading
            level={2}
            id="confirm-dialog-title"
            className="text-lg font-bold text-neutral-900 mb-2"
          >
            {title}
          </Heading>
          <Text
            variant="secondary"
            id="confirm-dialog-desc"
            className="text-sm leading-relaxed text-neutral-600"
          >
            {description}
          </Text>
          {children && <div className="mt-4">{children}</div>}
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3 mt-6 pt-4 border-t border-neutral-100">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onCancel}
            disabled={isPending}
            className="w-full sm:w-auto"
          >
            {cancelLabel}
          </Button>

          <Button
            ref={confirmBtnRef}
            type="button"
            variant={confirmButtonVariant}
            size="sm"
            onClick={onConfirm}
            disabled={isPending}
            className="w-full sm:w-auto"
          >
            {isPending ? "Processing..." : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
