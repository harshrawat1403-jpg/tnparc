"use client";

import React, { useActionState, useState, startTransition } from "react";
import {
  submitAssignRole,
  submitRemoveStaffRole,
  type RoleActionState,
} from "@/lib/actions/roles";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { ConfirmationDialog } from "@/components/ui/ConfirmationDialog";

interface StaffProfile {
  id: string;
  display_name: string;
  role: string;
  coordinator_slot: string | null;
  is_active: boolean;
}

interface RolesFormProps {
  staffProfiles: StaffProfile[];
}

export function RolesForm({ staffProfiles }: RolesFormProps) {
  const [assignState, assignAction, isAssignPending] = useActionState<
    RoleActionState,
    FormData
  >(submitAssignRole, {});

  const [removeState, removeAction, isRemovePending] = useActionState<
    RoleActionState,
    FormData
  >(submitRemoveStaffRole, {});

  const [selectedRole, setSelectedRole] = useState<string>("TNP_COORDINATOR");
  const [revokingProfile, setRevokingProfile] = useState<StaffProfile | null>(
    null
  );

  return (
    <div className="space-y-8">
      {/* Messages */}
      {assignState?.error && (
        <div
          role="alert"
          className="p-3 text-xs bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 rounded-[var(--radius-md)] border border-red-200 dark:border-red-900"
        >
          {assignState.error}
        </div>
      )}
      {assignState?.success && (
        <div
          role="status"
          className="p-3 text-xs bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 rounded-[var(--radius-md)] border border-emerald-200 dark:border-emerald-900"
        >
          {assignState.success}
        </div>
      )}
      {removeState?.error && (
        <div
          role="alert"
          className="p-3 text-xs bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 rounded-[var(--radius-md)] border border-red-200 dark:border-red-900"
        >
          {removeState.error}
        </div>
      )}
      {removeState?.success && (
        <div
          role="status"
          className="p-3 text-xs bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 rounded-[var(--radius-md)] border border-emerald-200 dark:border-emerald-900"
        >
          {removeState.success}
        </div>
      )}

      {/* Role Assignment Form */}
      <form action={assignAction} className="space-y-4">
        <h3 className="text-base font-semibold">Assign Staff Role</h3>
        <p className="text-xs text-[var(--color-text-secondary)]">
          Protected operation calling database procedure. Enforces cardinality
          (max 1 Secretary, max 1 Coord per slot).
        </p>

        <Input
          label="Target Profile UUID"
          type="text"
          id="targetProfileId"
          name="targetProfileId"
          required
          placeholder="00000000-0000-0000-0000-000000000000"
          helperText="UUID of the existing active profile."
        />

        <div>
          <label
            htmlFor="newRole"
            className="block text-xs font-medium text-[var(--color-text)] mb-1"
          >
            Target Role
          </label>
          <select
            id="newRole"
            name="newRole"
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            className="w-full text-sm rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)]"
          >
            <option value="TNP_COORDINATOR">TNP_COORDINATOR</option>
            <option value="TNP_SECRETARY">TNP_SECRETARY</option>
          </select>
        </div>

        {selectedRole === "TNP_COORDINATOR" && (
          <div>
            <label
              htmlFor="coordinatorSlot"
              className="block text-xs font-medium text-[var(--color-text)] mb-1"
            >
              Coordinator Slot
            </label>
            <select
              id="coordinatorSlot"
              name="coordinatorSlot"
              required
              className="w-full text-sm rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)]"
            >
              <option value="SLOT_1">SLOT_1 (Slot 1 Coordinator)</option>
              <option value="SLOT_2">SLOT_2 (Slot 2 Coordinator)</option>
            </select>
          </div>
        )}

        <Button
          type="submit"
          variant="primary"
          size="md"
          disabled={isAssignPending}
        >
          {isAssignPending ? "Executing Procedure..." : "Assign Role"}
        </Button>
      </form>

      {/* Existing Staff Table */}
      <div className="pt-6 border-t border-[var(--color-border)]">
        <h3 className="text-base font-semibold mb-3">
          Active Department Staff
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-[var(--color-text-secondary)]">
                <th className="py-2">Name</th>
                <th className="py-2">Role</th>
                <th className="py-2">Slot</th>
                <th className="py-2">Profile ID</th>
                <th className="py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {staffProfiles.map((p) => (
                <tr key={p.id}>
                  <td className="py-2 font-medium">{p.display_name}</td>
                  <td className="py-2">{p.role}</td>
                  <td className="py-2">{p.coordinator_slot || "—"}</td>
                  <td className="py-2 font-mono text-[10px] text-[var(--color-text-secondary)]">
                    {p.id}
                  </td>
                  <td className="py-2 text-right">
                    {p.role !== "SUPER_ADMIN" && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700 text-xs py-0.5 px-1.5"
                        disabled={isRemovePending}
                        onClick={() => setRevokingProfile(p)}
                      >
                        Revoke
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Accessible Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={revokingProfile !== null}
        title={`Revoke Role: ${revokingProfile?.display_name}`}
        description={`Are you sure you want to revoke the ${revokingProfile?.role} role from ${revokingProfile?.display_name}? They will immediately lose staff portal privileges and permissions.`}
        variant="danger"
        confirmLabel="Revoke Role"
        cancelLabel="Cancel"
        isPending={isRemovePending}
        onConfirm={() => {
          if (!revokingProfile) return;
          const targetId = revokingProfile.id;
          setRevokingProfile(null);
          const fd = new FormData();
          fd.set("targetProfileId", targetId);
          startTransition(() => {
            removeAction(fd);
          });
        }}
        onCancel={() => setRevokingProfile(null)}
      />
    </div>
  );
}
