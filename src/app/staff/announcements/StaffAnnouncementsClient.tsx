"use client";

import React, { useState, useTransition } from "react";
import { Card } from "@/components/ui/Card";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ConfirmationDialog } from "@/components/ui/ConfirmationDialog";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import {
  createAnnouncementAction,
  updateDraftAnnouncementAction,
  publishAnnouncementAction,
  archiveAnnouncementAction,
} from "@/lib/actions/announcements";

export interface AnnouncementItem {
  id: string;
  title: string;
  body: string;
  audience: "ALL" | "STUDENTS" | "RECRUITERS" | "STAFF";
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  created_by: string;
  creator_name: string;
  published_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

interface StaffAnnouncementsClientProps {
  initialAnnouncements: AnnouncementItem[];
  userRole: string;
}

export function StaffAnnouncementsClient({
  initialAnnouncements,
  userRole,
}: StaffAnnouncementsClientProps) {
  const [announcements, setAnnouncements] =
    useState<AnnouncementItem[]>(initialAnnouncements);
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [filterAudience, setFilterAudience] = useState<string>("ALL");

  // Create Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [newAudience, setNewAudience] = useState<
    "ALL" | "STUDENTS" | "RECRUITERS" | "STAFF"
  >("ALL");
  const [newExpiresAt, setNewExpiresAt] = useState("");

  // Edit Modal State
  const [editingItem, setEditingItem] = useState<AnnouncementItem | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editAudience, setEditAudience] = useState<
    "ALL" | "STUDENTS" | "RECRUITERS" | "STAFF"
  >("ALL");
  const [editExpiresAt, setEditExpiresAt] = useState("");

  type AnnouncementConfirmState =
    | { type: "publish"; id: string; title: string }
    | { type: "archive"; id: string; title: string }
    | null;

  const [confirmAction, setConfirmAction] =
    useState<AnnouncementConfirmState>(null);

  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [now] = useState(() => Date.now());

  const filtered = announcements.filter((a) => {
    if (filterStatus !== "ALL" && a.status !== filterStatus) return false;
    if (filterAudience !== "ALL" && a.audience !== filterAudience) return false;
    return true;
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    startTransition(async () => {
      const res = await createAnnouncementAction({
        title: newTitle,
        body: newBody,
        audience: newAudience,
        expiresAt: newExpiresAt ? new Date(newExpiresAt).toISOString() : null,
      });

      if (res.error) {
        setErrorMsg(res.error);
        return;
      }

      setSuccessMsg(res.success || "Announcement created successfully");
      setShowCreateModal(false);
      setNewTitle("");
      setNewBody("");
      setNewAudience("ALL");
      setNewExpiresAt("");

      // Optimistic addition
      if (res.data?.id) {
        const newItem: AnnouncementItem = {
          id: res.data.id,
          title: newTitle.trim(),
          body: newBody.trim(),
          audience: newAudience,
          status: "DRAFT",
          created_by: "",
          creator_name:
            userRole === "SUPER_ADMIN" ? "Super Admin" : "Secretary",
          published_at: null,
          expires_at: newExpiresAt
            ? new Date(newExpiresAt).toISOString()
            : null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        setAnnouncements([newItem, ...announcements]);
      }
    });
  };

  const handleStartEdit = (item: AnnouncementItem) => {
    setEditingItem(item);
    setEditTitle(item.title);
    setEditBody(item.body);
    setEditAudience(item.audience);
    setEditExpiresAt(
      item.expires_at
        ? new Date(item.expires_at).toISOString().slice(0, 16)
        : ""
    );
    setErrorMsg(null);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    setErrorMsg(null);

    startTransition(async () => {
      const res = await updateDraftAnnouncementAction({
        id: editingItem.id,
        title: editTitle,
        body: editBody,
        audience: editAudience,
        expiresAt: editExpiresAt ? new Date(editExpiresAt).toISOString() : null,
      });

      if (res.error) {
        setErrorMsg(res.error);
        return;
      }

      setSuccessMsg("Draft announcement updated successfully");
      setAnnouncements(
        announcements.map((a) =>
          a.id === editingItem.id
            ? {
                ...a,
                title: editTitle.trim(),
                body: editBody.trim(),
                audience: editAudience,
                expires_at: editExpiresAt
                  ? new Date(editExpiresAt).toISOString()
                  : null,
                updated_at: new Date().toISOString(),
              }
            : a
        )
      );
      setEditingItem(null);
    });
  };

  const executePublish = (id: string) => {
    setErrorMsg(null);
    setSuccessMsg(null);

    startTransition(async () => {
      const res = await publishAnnouncementAction(id);
      if (res.error) {
        setErrorMsg(res.error);
        return;
      }
      setSuccessMsg(res.success || "Announcement published successfully");
      setAnnouncements(
        announcements.map((a) =>
          a.id === id
            ? {
                ...a,
                status: "PUBLISHED",
                published_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              }
            : a
        )
      );
    });
  };

  const executeArchive = (id: string) => {
    setErrorMsg(null);
    setSuccessMsg(null);

    startTransition(async () => {
      const res = await archiveAnnouncementAction(id);
      if (res.error) {
        setErrorMsg(res.error);
        return;
      }
      setSuccessMsg(res.success || "Announcement archived successfully");
      setAnnouncements(
        announcements.map((a) =>
          a.id === id
            ? {
                ...a,
                status: "ARCHIVED",
                updated_at: new Date().toISOString(),
              }
            : a
        )
      );
    });
  };

  return (
    <div className="space-y-6">
      {/* Header & Primary Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Heading level={1} className="text-2xl font-bold text-neutral-900">
            Institutional Announcements
          </Heading>
          <Text className="text-sm text-neutral-600 mt-1">
            Broadcast role-targeted official notices to students, recruiters,
            and staff.
          </Text>
        </div>
        <Button
          onClick={() => setShowCreateModal(true)}
          variant="primary"
          className="self-start sm:self-auto"
        >
          + Create Announcement
        </Button>
      </div>

      {/* Messages */}
      {errorMsg && (
        <div className="p-4 rounded-md bg-red-50 border border-red-200 text-sm text-red-700">
          {errorMsg}
        </div>
      )}
      {successMsg && (
        <div className="p-4 rounded-md bg-green-50 border border-green-200 text-sm text-green-700">
          {successMsg}
        </div>
      )}

      {/* Filter Toolbar */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-4 items-center justify-between">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase text-neutral-500">
                Status:
              </span>
              <Select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="text-xs py-1 px-2"
              >
                <option value="ALL">All Statuses</option>
                <option value="DRAFT">Draft</option>
                <option value="PUBLISHED">Published</option>
                <option value="ARCHIVED">Archived</option>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase text-neutral-500">
                Audience:
              </span>
              <Select
                value={filterAudience}
                onChange={(e) => setFilterAudience(e.target.value)}
                className="text-xs py-1 px-2"
              >
                <option value="ALL">All Audiences</option>
                <option value="STUDENTS">Students</option>
                <option value="RECRUITERS">Recruiters</option>
                <option value="STAFF">Staff</option>
              </Select>
            </div>
          </div>
          <Text className="text-xs text-neutral-500">
            Showing {filtered.length} of {announcements.length} announcements
          </Text>
        </div>
      </Card>

      {/* Announcements List */}
      {filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <Text className="text-neutral-500">
            No announcements match the selected filters.
          </Text>
        </Card>
      ) : (
        <div className="space-y-4">
          {filtered.map((item) => {
            const isExpired =
              item.expires_at && new Date(item.expires_at).getTime() <= now;

            return (
              <Card key={item.id} className="p-5 border border-neutral-200">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Heading
                        level={3}
                        className="text-lg font-semibold text-neutral-900"
                      >
                        {item.title}
                      </Heading>
                      {/* Status Badge */}
                      <Badge
                        variant={
                          item.status === "PUBLISHED"
                            ? "success"
                            : item.status === "DRAFT"
                              ? "warning"
                              : "default"
                        }
                      >
                        {item.status}
                      </Badge>
                      {/* Audience Badge */}
                      <Badge variant="info">Target: {item.audience}</Badge>
                      {isExpired && item.status === "PUBLISHED" && (
                        <Badge variant="danger">EXPIRED</Badge>
                      )}
                    </div>

                    <p className="text-sm text-neutral-700 whitespace-pre-line leading-relaxed">
                      {item.body}
                    </p>

                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-500 pt-2 border-t border-neutral-100">
                      <span>Created by: {item.creator_name}</span>
                      <span>
                        Created:{" "}
                        {new Date(item.created_at).toLocaleDateString()}
                      </span>
                      {item.published_at && (
                        <span>
                          Published:{" "}
                          {new Date(item.published_at).toLocaleDateString()}
                        </span>
                      )}
                      {item.expires_at && (
                        <span
                          className={
                            isExpired ? "text-red-600 font-medium" : ""
                          }
                        >
                          Expires: {new Date(item.expires_at).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 self-end sm:self-start">
                    {item.status === "DRAFT" && (
                      <>
                        <Button
                          variant="secondary"
                          onClick={() => handleStartEdit(item)}
                          disabled={isPending}
                          className="text-xs py-1.5 px-3"
                        >
                          Edit
                        </Button>
                        <Button
                          variant="primary"
                          onClick={() =>
                            setConfirmAction({
                              type: "publish",
                              id: item.id,
                              title: item.title,
                            })
                          }
                          disabled={isPending}
                          className="text-xs py-1.5 px-3"
                        >
                          Publish
                        </Button>
                      </>
                    )}
                    {item.status !== "ARCHIVED" && (
                      <Button
                        variant="secondary"
                        onClick={() =>
                          setConfirmAction({
                            type: "archive",
                            id: item.id,
                            title: item.title,
                          })
                        }
                        disabled={isPending}
                        className="text-xs py-1.5 px-3 text-neutral-600 hover:text-red-700"
                      >
                        Archive
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Announcement Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg max-w-lg w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <Heading level={2} className="text-xl font-bold text-neutral-900">
                Create New Announcement
              </Heading>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-neutral-400 hover:text-neutral-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 uppercase mb-1">
                  Title *
                </label>
                <Input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Schedule for Campus Recruitment Drive 2026"
                  maxLength={200}
                  required
                />
                <span className="text-[10px] text-neutral-500 float-right">
                  {newTitle.length}/200
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 uppercase mb-1">
                  Target Audience *
                </label>
                <Select
                  value={newAudience}
                  onChange={(e) =>
                    setNewAudience(
                      e.target.value as
                        "ALL" | "STUDENTS" | "RECRUITERS" | "STAFF"
                    )
                  }
                  required
                >
                  <option value="ALL">ALL (Campus-Wide)</option>
                  <option value="STUDENTS">
                    STUDENTS (Active Placement Candidates)
                  </option>
                  <option value="RECRUITERS">
                    RECRUITERS (Industry Partners)
                  </option>
                  <option value="STAFF">
                    STAFF (Department & Coordinators)
                  </option>
                </Select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 uppercase mb-1">
                  Content Body *
                </label>
                <Textarea
                  value={newBody}
                  onChange={(e) => setNewBody(e.target.value)}
                  placeholder="Provide plain-text notification content. Line breaks are preserved."
                  rows={5}
                  maxLength={10000}
                  required
                />
                <span className="text-[10px] text-neutral-500 float-right">
                  {newBody.length}/10000
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 uppercase mb-1">
                  Expiration Date & Time (Optional)
                </label>
                <Input
                  type="datetime-local"
                  value={newExpiresAt}
                  onChange={(e) => setNewExpiresAt(e.target.value)}
                />
                <p className="text-[11px] text-neutral-500 mt-0.5">
                  After this timestamp, the announcement will automatically stop
                  appearing in public reader feeds.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-neutral-200">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={isPending}>
                  {isPending ? "Creating..." : "Save Draft"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Announcement Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg max-w-lg w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <Heading level={2} className="text-xl font-bold text-neutral-900">
                Edit Draft Announcement
              </Heading>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="text-neutral-400 hover:text-neutral-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 uppercase mb-1">
                  Title *
                </label>
                <Input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  maxLength={200}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 uppercase mb-1">
                  Target Audience *
                </label>
                <Select
                  value={editAudience}
                  onChange={(e) =>
                    setEditAudience(
                      e.target.value as
                        "ALL" | "STUDENTS" | "RECRUITERS" | "STAFF"
                    )
                  }
                  required
                >
                  <option value="ALL">ALL (Campus-Wide)</option>
                  <option value="STUDENTS">
                    STUDENTS (Active Placement Candidates)
                  </option>
                  <option value="RECRUITERS">
                    RECRUITERS (Industry Partners)
                  </option>
                  <option value="STAFF">
                    STAFF (Department & Coordinators)
                  </option>
                </Select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 uppercase mb-1">
                  Content Body *
                </label>
                <Textarea
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  rows={5}
                  maxLength={10000}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 uppercase mb-1">
                  Expiration Date & Time (Optional)
                </label>
                <Input
                  type="datetime-local"
                  value={editExpiresAt}
                  onChange={(e) => setEditExpiresAt(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-neutral-200">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setEditingItem(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={isPending}>
                  {isPending ? "Saving..." : "Update Draft"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Accessible Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={confirmAction !== null}
        title={
          confirmAction?.type === "publish"
            ? `Confirm Publication`
            : `Confirm Archival`
        }
        description={
          confirmAction?.type === "publish"
            ? `Are you sure you want to publish "${confirmAction.title}"? Once published, its title, body, and audience become permanently immutable.`
            : `Are you sure you want to archive "${confirmAction?.title}"? It will immediately be removed from all active feeds.`
        }
        variant={confirmAction?.type === "archive" ? "danger" : "primary"}
        confirmLabel={
          confirmAction?.type === "publish"
            ? "Publish Announcement"
            : "Archive Announcement"
        }
        cancelLabel="Cancel"
        isPending={isPending}
        onConfirm={() => {
          if (!confirmAction) return;
          const { type, id } = confirmAction;
          setConfirmAction(null);
          if (type === "publish") {
            executePublish(id);
          } else if (type === "archive") {
            executeArchive(id);
          }
        }}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}
