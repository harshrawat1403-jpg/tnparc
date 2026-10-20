"use client";

import React, { useState, useTransition } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import {
  submitCreateSkill,
  submitUpdateSkill,
  submitDeactivateSkill,
  submitReactivateSkill,
} from "@/lib/actions/skills";

export interface SkillItem {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

interface SkillsCatalogClientProps {
  initialSkills: SkillItem[];
  canManage: boolean;
}

export function SkillsCatalogClient({
  initialSkills,
  canManage,
}: SkillsCatalogClientProps) {
  const [skills, setSkills] = useState<SkillItem[]>(initialSkills);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [isPending, startTransition] = useTransition();

  // Create Skill Form State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createCategory, setCreateCategory] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  // Edit Skill Modal State
  const [editingSkill, setEditingSkill] = useState<SkillItem | null>(null);
  const [editName, setEditName] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editError, setEditError] = useState<string | null>(null);

  // Filter skills
  const categories = Array.from(
    new Set(
      skills.map((s) => s.category?.trim() || "Uncategorized").filter(Boolean)
    )
  ).sort();

  const filteredSkills = skills.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.category && s.category.toLowerCase().includes(search.toLowerCase())) ||
      (s.description &&
        s.description.toLowerCase().includes(search.toLowerCase()));

    const sCat = s.category?.trim() || "Uncategorized";
    const matchesCategory = categoryFilter === "ALL" || sCat === categoryFilter;

    return matchesSearch && matchesCategory;
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    const formData = new FormData();
    formData.append("name", createName);
    formData.append("category", createCategory);
    formData.append("description", createDescription);

    startTransition(async () => {
      const res = await submitCreateSkill(null, formData);
      if (res.error) {
        setCreateError(res.error);
      } else {
        setShowCreateModal(false);
        setCreateName("");
        setCreateCategory("");
        setCreateDescription("");
        window.location.reload();
      }
    });
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSkill) return;
    setEditError(null);

    const formData = new FormData();
    formData.append("skillId", editingSkill.id);
    formData.append("name", editName);
    formData.append("category", editCategory);
    formData.append("description", editDescription);

    startTransition(async () => {
      const res = await submitUpdateSkill(null, formData);
      if (res.error) {
        setEditError(res.error);
      } else {
        setEditingSkill(null);
        window.location.reload();
      }
    });
  };

  const handleToggleActive = (skill: SkillItem) => {
    startTransition(async () => {
      if (skill.is_active) {
        await submitDeactivateSkill(skill.id);
      } else {
        await submitReactivateSkill(skill.id);
      }
      setSkills((prev) =>
        prev.map((s) =>
          s.id === skill.id ? { ...s, is_active: !s.is_active } : s
        )
      );
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Top Bar: Search, Category Filter, and Add Button */}
      <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-3 flex-1 max-w-xl">
          <Input
            placeholder="Search skills catalog..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1"
          />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 text-sm rounded border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)]"
          >
            <option value="ALL">All Categories ({skills.length})</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        {canManage && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowCreateModal(true)}
          >
            + Add New Skill
          </Button>
        )}
      </div>

      {!canManage && (
        <div className="p-3 bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded text-xs text-[var(--color-text-secondary)]">
          <strong>Coordinator Notice:</strong> Coordinators have read-only
          access to the skills catalog. Only Super Admins and TNP Secretaries
          can create, edit, or deactivate canonical skills.
        </div>
      )}

      {/* Skills Grid */}
      {filteredSkills.length === 0 ? (
        <Card padding="lg" className="text-center py-12">
          <p className="text-sm text-[var(--color-text-secondary)]">
            No skills match your search or filter.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSkills.map((skill) => (
            <Card
              key={skill.id}
              padding="md"
              className={`flex flex-col justify-between ${
                !skill.is_active
                  ? "opacity-60 bg-[var(--color-surface-hover)]"
                  : ""
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h4 className="font-semibold text-base text-[var(--color-text-primary)]">
                    {skill.name}
                  </h4>
                  <Badge
                    variant={skill.is_active ? "success" : "default"}
                    size="sm"
                  >
                    {skill.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>

                {skill.category && (
                  <span className="inline-block text-xs font-medium text-[var(--color-primary)] mb-2">
                    {skill.category}
                  </span>
                )}

                {skill.description ? (
                  <p className="text-xs text-[var(--color-text-secondary)] line-clamp-2 mb-4">
                    {skill.description}
                  </p>
                ) : (
                  <p className="text-xs italic text-[var(--color-text-secondary)] mb-4">
                    No description provided
                  </p>
                )}
              </div>

              {canManage && (
                <div className="pt-3 border-t border-[var(--color-border)] flex items-center justify-between text-xs mt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingSkill(skill);
                      setEditName(skill.name);
                      setEditCategory(skill.category || "");
                      setEditDescription(skill.description || "");
                    }}
                    className="text-[var(--color-primary)] hover:underline font-medium"
                    disabled={isPending}
                  >
                    Edit
                  </button>

                  <button
                    type="button"
                    onClick={() => handleToggleActive(skill)}
                    className={`font-medium ${
                      skill.is_active
                        ? "text-[var(--color-error)] hover:underline"
                        : "text-[var(--color-success)] hover:underline"
                    }`}
                    disabled={isPending}
                  >
                    {skill.is_active ? "Deactivate" : "Reactivate"}
                  </button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Modal: Create Skill */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold mb-4 text-[var(--color-text-primary)]">
              Add New Canonical Skill
            </h3>
            <form onSubmit={handleCreateSubmit} className="flex flex-col gap-4">
              {createError && (
                <div className="p-3 bg-red-100 border border-red-300 text-red-800 rounded text-xs">
                  {createError}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium mb-1 text-[var(--color-text-secondary)]">
                  Skill Name *
                </label>
                <Input
                  required
                  placeholder="e.g. Autodesk Revit, GIS, SketchUp"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1 text-[var(--color-text-secondary)]">
                  Category (Optional)
                </label>
                <Input
                  placeholder="e.g. Design & Modeling, Urban Analysis"
                  value={createCategory}
                  onChange={(e) => setCreateCategory(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1 text-[var(--color-text-secondary)]">
                  Description (Optional)
                </label>
                <Textarea
                  placeholder="Brief description or guidelines for this skill..."
                  rows={3}
                  value={createDescription}
                  onChange={(e) => setCreateDescription(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowCreateModal(false)}
                  disabled={isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={isPending}
                >
                  {isPending ? "Creating..." : "Create Skill"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Skill */}
      {editingSkill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold mb-4 text-[var(--color-text-primary)]">
              Edit Skill: {editingSkill.name}
            </h3>
            <form onSubmit={handleEditSubmit} className="flex flex-col gap-4">
              {editError && (
                <div className="p-3 bg-red-100 border border-red-300 text-red-800 rounded text-xs">
                  {editError}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium mb-1 text-[var(--color-text-secondary)]">
                  Skill Name *
                </label>
                <Input
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1 text-[var(--color-text-secondary)]">
                  Category (Optional)
                </label>
                <Input
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1 text-[var(--color-text-secondary)]">
                  Description (Optional)
                </label>
                <Textarea
                  rows={3}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setEditingSkill(null)}
                  disabled={isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={isPending}
                >
                  {isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
