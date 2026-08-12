import React, { useState, useEffect } from "react";
import { Users, Plus, Trash2, Search, User, X, ShieldCheck, Check, GripVertical, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge/Badge";
import { IconListNumbers } from "@tabler/icons-react";
import { Button } from "@/components/ui/button/Button";
import { cn } from "@/components/ui/utils";
import { FormModal } from "@/components/ui/modal/FormModal";
import { metadataApi } from "@/services/api/metadata";

import { Reviewer } from "./types";

interface AppUser {
    id: string;
    employeeCode: string;
    fullName: string;
    username: string;
    email: string;
    position: string;
    department: string;
}

interface ReviewersTabProps {
    onCountChange?: (count: number) => void;
    reviewers: Reviewer[];
    onReviewersChange: (reviewers: Reviewer[]) => void;
    isModalOpen?: boolean;
    onModalClose?: () => void;
}

interface UserSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (users: AppUser[]) => void;
    existingIds: string[];
}

const UserSelectionModal: React.FC<UserSelectionModalProps> = ({ isOpen, onClose, onConfirm, existingIds }) => {
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [selectedUsersById, setSelectedUsersById] = useState<Record<string, AppUser>>({});
    const [users, setUsers] = useState<AppUser[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const mapUsers = (response: Awaited<ReturnType<typeof metadataApi.getUsersLookup>>): AppUser[] =>
        (response ?? []).map((user) => ({
            id: user.id,
            employeeCode: user.employeeCode || "",
            fullName: user.fullName || user.username || "",
            username: user.username || "",
            email: user.email || "",
            position: user.position || "",
            department: user.department || "",
        }));

    useEffect(() => {
        if (isOpen) {
            setSearchTerm("");
            setSelectedIds([]);
            setSelectedUsersById({});
            setIsLoading(true);
            // Ungated metadata lookup, not the settings.user.view-gated admin user list —
            // any user assembling a document's reviewer roster needs to pick colleagues
            // without requiring User Management access.
            metadataApi.getUsersLookup()
              .then((response) => setUsers(mapUsers(response)))
              .catch(() => setUsers([]))
              .finally(() => setIsLoading(false));
        }
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        const trimmed = searchTerm.trim();
        if (trimmed.length === 0) return;
        setIsLoading(true);
        const timer = setTimeout(() => {
            metadataApi.getUsersLookup({ search: trimmed })
              .then((response) => setUsers(mapUsers(response)))
              .catch(() => setUsers([]))
              .finally(() => setIsLoading(false));
        }, 300);
        return () => clearTimeout(timer);
    }, [searchTerm, isOpen]);

    const filteredUsers = users;

    const handleToggleUser = (userId: string) => {
        setSelectedIds(prev =>
            prev.includes(userId)
                ? prev.filter(id => id !== userId)
                : [...prev, userId]
        );
        const user = users.find(u => u.id === userId);
        if (user) {
            setSelectedUsersById(prev => ({ ...prev, [userId]: user }));
        }
    };

    const handleSave = () => {
        const selectedUsers = selectedIds
            .map(id => selectedUsersById[id])
            .filter((u): u is AppUser => !!u);
        onConfirm(selectedUsers);
        onClose();
    };

    return (
        <FormModal
            isOpen={isOpen}
            onClose={onClose}
            onConfirm={handleSave}
            title="Setup Reviewers"
            description="Select users who will review this document."
            confirmText={`Update Reviewers (${selectedIds.length})`}
            confirmDisabled={selectedIds.length === 0}
            size="lg"
        >
            <div className="space-y-4">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search by name, position, or department..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full h-9 pl-9 pr-4 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 placeholder:text-slate-400 transition-colors"
                        autoFocus
                    />
                </div>

                <div className="overflow-y-auto max-h-[350px] -mx-1 px-1 custom-scrollbar min-h-[150px]">
                    {isLoading ? (
                        <div className="text-center py-12 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                            <p className="text-sm font-semibold text-slate-900">Loading users...</p>
                            <p className="text-xs text-slate-500 mt-1">Please wait while we load reviewer candidates</p>
                        </div>
                    ) : filteredUsers.length > 0 ? (
                        <div className="space-y-2">
                            {filteredUsers.map((user, index) => {
                                const isAlreadyAdded = existingIds.includes(user.id);
                                const isSelected = selectedIds.includes(user.id);

                                return (
                                    <button
                                        key={user.id}
                                        onClick={() => !isAlreadyAdded && handleToggleUser(user.id)}
                                        disabled={isAlreadyAdded}
                                        className={cn(
                                            "w-full flex items-center gap-3 py-2.5 px-3 rounded-lg transition-all group text-left border",
                                            isSelected
                                                ? "bg-emerald-50 border-emerald-200 shadow-sm"
                                                : isAlreadyAdded
                                                    ? "bg-slate-50 border-slate-100 opacity-60 cursor-not-allowed"
                                                    : "bg-white border-slate-200 hover:border-emerald-500/30 hover:shadow-sm"
                                        )}
                                    >
                                        <div className={cn(
                                            "w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 transition-colors border",
                                            isSelected
                                                ? "bg-emerald-100 border-emerald-200 text-emerald-700"
                                                : "bg-slate-100 border-slate-200 text-slate-500"
                                        )}>
                                            {isSelected ? <Check className="h-4 w-4" /> : (index + 1)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-medium text-slate-900 truncate text-xs md:text-sm flex items-center gap-2">
                                                {user.fullName}
                                                {isAlreadyAdded && (
                                                    <Badge color="slate" size="sm">
                                                        Added
                                                    </Badge>
                                                )}
                                            </div>
                                            <div className="text-xs text-slate-500 truncate mt-0.5">
                                                <span className="text-emerald-600 font-medium mr-1.5">{user.employeeCode}</span>
                                                • {user.position} • {user.department}
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="text-center py-12 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                            <div className="h-12 w-12 rounded-full bg-white shadow-sm flex items-center justify-center mx-auto mb-3">
                                <User className="h-6 w-6 text-slate-300" />
                            </div>
                            <p className="text-sm font-semibold text-slate-900">No users found</p>
                            <p className="text-xs text-slate-500 mt-1">Try a different search term</p>
                        </div>
                    )}
                </div>
            </div>
        </FormModal>
    );
};

export const ReviewersTab: React.FC<ReviewersTabProps> = ({
    onCountChange,
    reviewers,
    onReviewersChange,
    isModalOpen: externalModalOpen,
    onModalClose: externalModalClose
}) => {
    const [internalModalOpen, setInternalModalOpen] = useState(false);
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

    // Use external modal state if provided, otherwise use internal
    const isModalOpen = externalModalOpen !== undefined ? externalModalOpen : internalModalOpen;
    const handleModalClose = () => {
        if (externalModalClose) {
            externalModalClose();
        } else {
            setInternalModalOpen(false);
        }
    };
    const handleModalOpen = () => {
        if (externalModalClose) {
            // When using external control, we can't directly open the modal
            // The parent component should handle opening via button click
        } else {
            setInternalModalOpen(true);
        }
    };

    useEffect(() => {
        onCountChange?.(reviewers.length);
    }, [reviewers.length, onCountChange]);

    const handleAddReviewers = (users: AppUser[]) => {
        const maxOrder = reviewers.length > 0 ? Math.max(...reviewers.map(r => r.order)) : 0;
        const newReviewers = users.map((user, idx) => ({
            id: user.id,
            fullName: user.fullName,
            username: user.username,
            position: user.position,
            email: user.email,
            department: user.department,
            order: maxOrder + idx + 1
        }));
        onReviewersChange([...reviewers, ...newReviewers]);
    };

    const removeReviewer = (id: string) => {
        const updatedReviewers = reviewers.filter(r => r.id !== id);
        // Reorder after removal
        const reordered = updatedReviewers.map((r, idx) => ({ ...r, order: idx + 1 }));
        onReviewersChange(reordered);
    };

    const handleDragStart = (e: React.DragEvent, index: number) => {
        setDraggedIndex(index);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', e.currentTarget.innerHTML);
        if (e.currentTarget instanceof HTMLElement) {
            e.currentTarget.style.opacity = '0.4';
        }
    };

    const handleDragEnd = (e: React.DragEvent) => {
        if (e.currentTarget instanceof HTMLElement) {
            e.currentTarget.style.opacity = '1';
        }
        setDraggedIndex(null);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = (e: React.DragEvent, dropIndex: number) => {
        e.preventDefault();
        if (draggedIndex === null || draggedIndex === dropIndex) return;

        const reordered = [...reviewers];
        const [draggedItem] = reordered.splice(draggedIndex, 1);
        reordered.splice(dropIndex, 0, draggedItem);

        // Update order numbers
        const updatedReviewers = reordered.map((r, idx) => ({ ...r, order: idx + 1 }));
        onReviewersChange(updatedReviewers);
    };

    return (
        <div className="space-y-4">
            {reviewers.length > 0 ? (
                <div className="border rounded-xl bg-white shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th className="py-2.5 px-2 sm:py-3.5 sm:px-4 text-center text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap w-10 sm:w-16">
                                        No.
                                    </th>
                                    <th className="py-2.5 px-2 sm:py-3.5 sm:px-4 text-left text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                                        User
                                    </th>
                                    <th className="py-2.5 px-2 sm:py-3.5 sm:px-4 text-left text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                                        Email
                                    </th>
                                    <th className="py-2.5 px-2 sm:py-3.5 sm:px-4 text-left text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                                        Position
                                    </th>
                                    <th className="py-2.5 px-2 sm:py-3.5 sm:px-4 text-left text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                                        Department
                                    </th>
                                    <th className="py-2.5 px-2 sm:py-3.5 sm:px-4 text-left text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                                        Sequence
                                    </th>
                                    <th className="py-2.5 px-2 sm:py-3.5 sm:px-4 text-center text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap w-16 sm:w-24">
                                        Action
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 bg-white">
                                {reviewers
                                    .sort((a, b) => a.order - b.order)
                                    .map((reviewer, index) => (
                                        <tr
                                            key={reviewer.id}
                                            draggable={true}
                                            onDragStart={(e) => handleDragStart(e, index)}
                                            onDragEnd={handleDragEnd}
                                            onDragOver={(e) => handleDragOver(e)}
                                            onDrop={(e) => handleDrop(e, index)}
                                            className={cn(
                                                "hover:bg-slate-50/80 transition-colors cursor-move",
                                                draggedIndex === index && "opacity-40 bg-slate-100"
                                            )}
                                        >
                                            <td className="py-2 px-2 sm:py-3.5 sm:px-4 text-xs sm:text-sm text-slate-500 whitespace-nowrap text-center font-medium">
                                                {index + 1}
                                            </td>
                                            <td className="py-2 px-2 sm:py-3.5 sm:px-4 text-xs sm:text-sm whitespace-nowrap">
                                                <div className="flex items-center gap-2 sm:gap-3">
                                                    <div>
                                                        <div className="font-medium text-slate-900">{reviewer.fullName}</div>
                                                        <div className="text-2xs text-slate-500">{reviewer.username}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-2 px-2 sm:py-3.5 sm:px-4 text-xs sm:text-sm text-slate-600 whitespace-nowrap">
                                                {reviewer.email}
                                            </td>
                                            <td className="py-2 px-2 sm:py-3.5 sm:px-4 text-xs sm:text-sm text-slate-600 whitespace-nowrap">
                                                {reviewer.position}
                                            </td>
                                            <td className="py-2 px-2 sm:py-3.5 sm:px-4 text-xs sm:text-sm text-slate-600 whitespace-nowrap">
                                                {reviewer.department}
                                            </td>
                                            <td className="py-2 px-2 sm:py-3.5 sm:px-4 text-xs sm:text-sm whitespace-nowrap">
                                                <div className="flex items-center gap-1.5 sm:gap-2">
                                                    <GripVertical className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-400" />
                                                    <span className="inline-flex items-center justify-center h-5 w-5 sm:h-6 sm:w-6 rounded-full bg-emerald-100 text-emerald-700 text-2xs font-bold">
                                                        {reviewer.order}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="py-2 px-2 sm:py-3.5 sm:px-4 text-center whitespace-nowrap">
                                                <Button
                                                    onClick={() => removeReviewer(reviewer.id)}
                                                    variant="ghost"
                                                    size="icon-sm"
                                                    className="text-slate-400 hover:text-red-500 hover:bg-red-50"
                                                    title="Remove reviewer"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <div
                    className="group relative flex flex-col items-center justify-center py-12 p-4 md:p-5 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl transition-all"
                >
                    <div className="h-12 w-12 bg-white rounded-full shadow-sm flex items-center justify-center mb-3 duration-200">
                        <Users className="h-6 w-6 text-slate-400" />
                    </div>
                    <p className="text-sm font-medium text-slate-500">No Reviewers Selected</p>
                </div>
            )}

            <UserSelectionModal
                isOpen={isModalOpen}
                onClose={handleModalClose}
                onConfirm={handleAddReviewers}
                existingIds={reviewers.map(r => r.id)}
            />
        </div>
    );
};
