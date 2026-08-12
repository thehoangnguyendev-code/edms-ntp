import React, { useMemo, useState, useEffect } from "react";
import { Users, Trash2, Search, User, Check, GripVertical } from "lucide-react";
import { Badge } from "@/components/ui/badge/Badge";
import { Button } from "@/components/ui/button/Button";
import { cn } from "@/components/ui/utils";
import { FormModal } from "@/components/ui/modal/FormModal";
import { securityApi } from "@/services/api/security";
import { filterOutExcludedWorkflowParticipants } from "@/features/documents/shared/workflowParticipantFilters";
import type { User as AppUser } from "@/types";

export interface Participant extends Pick<AppUser, "id" | "fullName" | "username" | "position" | "email" | "department"> {
    order?: number;
    employeeCode?: string | null;
}

export interface ParticipantRosterTabProps {
    /** Distinguishes the roster's role — drives copy/labels only, not authorization. */
    roleLabel: "Reviewer" | "Approver";
    /** Permission code used to fetch eligible candidates via `GET /security/eligible-users`. */
    permissionCode: string;
    /** Existing revision: use server-side eligibility (permission + scope + SoD) rather than a permission-only lookup. */
    revisionId?: string | null;
    participants: Participant[];
    onParticipantsChange: (participants: Participant[]) => void;
    /** Reviewers: many people, sequenced. Approver: exactly one (new selection replaces the existing one). */
    multiSelect: boolean;
    /** Workspace/edit views allow removing and (for reviewers) drag-reordering; creation views are add-only. */
    allowRemove?: boolean;
    allowReorder?: boolean;
    onCountChange?: (count: number) => void;
    isModalOpen?: boolean;
    onModalClose?: () => void;
    isReadOnly?: boolean;
    excludedUserIds?: string[];
}

const UserSelectionModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (users: Participant[]) => void;
    roleLabel: "Reviewer" | "Approver";
    permissionCode: string;
    revisionId?: string | null;
    multiSelect: boolean;
    existingIds: string[];
    excludedUserIds?: string[];
}> = ({ isOpen, onClose, onConfirm, roleLabel, permissionCode, revisionId, multiSelect, existingIds, excludedUserIds }) => {
    const [searchTerm, setSearchTerm] = useState("");
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [selectedUsersById, setSelectedUsersById] = useState<Record<string, Participant>>({});
    const [remoteUsers, setRemoteUsers] = useState<Participant[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [candidatePage, setCandidatePage] = useState(1);
    const [hasMoreCandidates, setHasMoreCandidates] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setSearchTerm("");
            setDebouncedSearchTerm("");
            setSelectedIds([]);
            setSelectedUsersById({});
            setCandidatePage(1);
            setHasMoreCandidates(false);
        }
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        const timer = setTimeout(() => setDebouncedSearchTerm(searchTerm.trim()), 300);
        return () => clearTimeout(timer);
    }, [searchTerm, isOpen]);

    useEffect(() => {
        setCandidatePage(1);
    }, [debouncedSearchTerm, revisionId, roleLabel]);

    useEffect(() => {
        if (!isOpen) {
            setRemoteUsers([]);
            setIsLoading(false);
            return;
        }
        let alive = true;
        setIsLoading(true);
        (revisionId
            ? securityApi.getEligibleParticipants(
                "DOCUMENT_REVISION", revisionId, roleLabel.toUpperCase(), debouncedSearchTerm || undefined, candidatePage,
            ).then((response) => ({
                users: response.data.map((user) => ({
                    id: user.userId,
                    fullName: user.fullName || "",
                    username: user.fullName || "",
                    position: "-",
                    department: user.department || "",
                    email: "",
                    employeeCode: user.employeeCode || "",
                })),
                hasMore: response.pagination.page < response.pagination.totalPages,
            }))
            : securityApi.getEligibleUsers(permissionCode, debouncedSearchTerm || undefined)
                .then((users) => ({ users, hasMore: false })))
            .then(({ users, hasMore }) => {
                if (!alive) return;
                const mapped = (users || []).map((user) => ({
                        id: user.id,
                        fullName: user.fullName || "",
                        username: user.fullName || "",
                        position: user.position || "-",
                        department: user.department || "",
                        email: user.email || "",
                        employeeCode: user.employeeCode || "",
                    }));
                setRemoteUsers((existing) => candidatePage === 1 ? mapped : [...existing, ...mapped.filter((user) => !existing.some((item) => item.id === user.id))]);
                setHasMoreCandidates(hasMore);
            })
            .catch((error) => {
                console.error(`Failed to load users eligible to be ${roleLabel}`, error);
                if (alive) setRemoteUsers([]);
            })
            .finally(() => {
                if (alive) setIsLoading(false);
            });
        return () => {
            alive = false;
        };
    }, [isOpen, permissionCode, roleLabel, revisionId, debouncedSearchTerm, candidatePage]);

    const filteredUsers = useMemo(
        () => filterOutExcludedWorkflowParticipants(remoteUsers, excludedUserIds || []),
        [remoteUsers, excludedUserIds]
    );

    const handleToggleUser = (userId: string) => {
        if (multiSelect) {
            setSelectedIds((prev) => (prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]));
        } else {
            setSelectedIds((prev) => (prev[0] === userId ? [] : [userId]));
        }
        const user = remoteUsers.find((u) => u.id === userId);
        if (user) {
            setSelectedUsersById((prev) => ({ ...prev, [userId]: user }));
        }
    };

    const handleSave = () => {
        const selectedUsers = selectedIds
            .map((id) => selectedUsersById[id])
            .filter((u): u is Participant => !!u);
        onConfirm(selectedUsers);
        onClose();
    };

    return (
        <FormModal
            isOpen={isOpen}
            onClose={onClose}
            onConfirm={handleSave}
            title={multiSelect ? `Setup ${roleLabel}s` : `Setup ${roleLabel}`}
            description={multiSelect ? `Select users who will ${roleLabel.toLowerCase()} this document.` : `Select the final ${roleLabel.toLowerCase()} for this document.`}
            confirmText={multiSelect ? `Update ${roleLabel}s (${selectedIds.length})` : "Commit Selection"}
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
                            <div className="h-12 w-12 rounded-full bg-white shadow-sm flex items-center justify-center mx-auto mb-3 animate-pulse">
                                <User className="h-6 w-6 text-slate-300" />
                            </div>
                            <p className="text-sm font-semibold text-slate-900">Loading {roleLabel.toLowerCase()}s...</p>
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
                                                {isAlreadyAdded && <Badge color="slate" size="sm">Added</Badge>}
                                            </div>
                                            <div className="text-xs text-slate-500 truncate mt-0.5">
                                                <span className="text-emerald-600 font-medium mr-1.5">{user.employeeCode || "-"}</span>
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
                            <p className="text-sm font-semibold text-slate-900">
                                {remoteUsers.length === 0 && !debouncedSearchTerm ? `No users have ${roleLabel} permission yet` : "No users found"}
                            </p>
                            <p className="text-xs text-slate-500 mt-1">
                                {remoteUsers.length === 0 && !debouncedSearchTerm
                                    ? `Assign the "${permissionCode}" permission via Permission Sets / Access Profiles before selecting a ${roleLabel.toLowerCase()}.`
                                    : "Try a different search term"}
                            </p>
                        </div>
                    )}
                </div>
                {hasMoreCandidates && revisionId && (
                    <div className="flex justify-center">
                        <Button size="sm" variant="outline" loading={isLoading} onClick={() => setCandidatePage((page) => page + 1)}>
                            Load more users
                        </Button>
                    </div>
                )}
            </div>
        </FormModal>
    );
};

export const ParticipantRosterTab: React.FC<ParticipantRosterTabProps> = ({
    roleLabel,
    permissionCode,
    revisionId,
    participants,
    onParticipantsChange,
    multiSelect,
    allowRemove = false,
    allowReorder = false,
    onCountChange,
    isModalOpen: externalModalOpen,
    onModalClose: externalModalClose,
    isReadOnly = false,
    excludedUserIds = [],
}) => {
    const [internalModalOpen, setInternalModalOpen] = useState(false);
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
    const isModalOpen = externalModalOpen !== undefined ? externalModalOpen : internalModalOpen;

    const handleModalClose = () => {
        if (externalModalClose) externalModalClose();
        else setInternalModalOpen(false);
    };

    useEffect(() => {
        onCountChange?.(participants.length);
    }, [participants.length, onCountChange]);

    const handleAddParticipants = (usersToAdd: Participant[]) => {
        if (!multiSelect) {
            // Single-select (Approver): a new selection replaces the existing one.
            onParticipantsChange(usersToAdd.slice(0, 1));
            return;
        }
        const maxOrder = participants.length > 0 ? Math.max(...participants.map((p) => p.order ?? 0)) : 0;
        const newParticipants = usersToAdd.map((user, idx) => ({ ...user, order: maxOrder + idx + 1 }));
        onParticipantsChange([...participants, ...newParticipants]);
    };

    const removeParticipant = (id: string) => {
        const updated = participants.filter((p) => p.id !== id);
        const reordered = multiSelect ? updated.map((p, idx) => ({ ...p, order: idx + 1 })) : updated;
        onParticipantsChange(reordered);
    };

    const handleDragStart = (e: React.DragEvent, index: number) => {
        setDraggedIndex(index);
        e.dataTransfer.effectAllowed = "move";
    };
    const handleDragEnd = () => setDraggedIndex(null);
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
    };
    const handleDrop = (e: React.DragEvent, dropIndex: number) => {
        e.preventDefault();
        if (draggedIndex === null || draggedIndex === dropIndex) return;
        const reordered = [...participants];
        const [draggedItem] = reordered.splice(draggedIndex, 1);
        reordered.splice(dropIndex, 0, draggedItem);
        onParticipantsChange(reordered.map((p, idx) => ({ ...p, order: idx + 1 })));
        setDraggedIndex(null);
    };

    const sorted = multiSelect ? [...participants].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)) : participants;

    return (
        <div className="space-y-4">
            {sorted.length > 0 ? (
                <div className="border rounded-xl bg-white shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th className="py-2.5 px-2 sm:py-3.5 sm:px-4 text-center text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap w-10 sm:w-16">No.</th>
                                    <th className="py-2.5 px-2 sm:py-3.5 sm:px-4 text-left text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">User</th>
                                    <th className="py-2.5 px-2 sm:py-3.5 sm:px-4 text-left text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap hidden md:table-cell">Email</th>
                                    <th className="py-2.5 px-2 sm:py-3.5 sm:px-4 text-left text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap hidden lg:table-cell">Position</th>
                                    <th className="py-2.5 px-2 sm:py-3.5 sm:px-4 text-left text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap hidden md:table-cell">Department</th>
                                    <th className="py-2.5 px-2 sm:py-3.5 sm:px-4 text-left text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">{multiSelect ? "Sequence" : "Role"}</th>
                                    {allowRemove && (
                                        <th className="py-2.5 px-2 sm:py-3.5 sm:px-4 text-center text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap w-16 sm:w-24">Action</th>
                                    )}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 bg-white">
                                {sorted.map((participant, index) => (
                                    <tr
                                        key={participant.id}
                                        draggable={allowReorder}
                                        onDragStart={allowReorder ? (e) => handleDragStart(e, index) : undefined}
                                        onDragEnd={allowReorder ? handleDragEnd : undefined}
                                        onDragOver={allowReorder ? handleDragOver : undefined}
                                        onDrop={allowReorder ? (e) => handleDrop(e, index) : undefined}
                                        className={cn(
                                            "hover:bg-slate-50/80 transition-colors",
                                            allowReorder && "cursor-move",
                                            draggedIndex === index && "opacity-40 bg-slate-100"
                                        )}
                                    >
                                        <td className="py-2 px-2 sm:py-3.5 sm:px-4 text-xs sm:text-sm text-slate-500 whitespace-nowrap text-center font-medium">{index + 1}</td>
                                        <td className="py-2 px-2 sm:py-3.5 sm:px-4 text-xs sm:text-sm whitespace-nowrap">
                                            <div className="font-medium text-slate-900">{participant.fullName}</div>
                                            <div className="text-2xs text-slate-500">{participant.username}</div>
                                        </td>
                                        <td className="py-2 px-2 sm:py-3.5 sm:px-4 text-xs sm:text-sm text-slate-600 whitespace-nowrap hidden md:table-cell">{participant.email}</td>
                                        <td className="py-2 px-2 sm:py-3.5 sm:px-4 text-xs sm:text-sm text-slate-600 whitespace-nowrap hidden lg:table-cell">{participant.position}</td>
                                        <td className="py-2 px-2 sm:py-3.5 sm:px-4 text-xs sm:text-sm text-slate-600 whitespace-nowrap hidden md:table-cell">{participant.department}</td>
                                        <td className="py-2 px-2 sm:py-3.5 sm:px-4 text-xs sm:text-sm whitespace-nowrap">
                                            {multiSelect ? (
                                                <div className="flex items-center gap-1.5 sm:gap-2">
                                                    {allowReorder && <GripVertical className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-400" />}
                                                    <span className="inline-flex items-center justify-center h-5 w-5 sm:h-6 sm:w-6 rounded-full bg-emerald-100 text-emerald-700 text-2xs font-bold">
                                                        {participant.order}
                                                    </span>
                                                </div>
                                            ) : (
                                                <Badge color="emerald">{roleLabel}</Badge>
                                            )}
                                        </td>
                                        {allowRemove && (
                                            <td className="py-2 px-2 sm:py-3.5 sm:px-4 text-center whitespace-nowrap">
                                                <Button
                                                    onClick={() => removeParticipant(participant.id)}
                                                    variant="ghost"
                                                    size="icon-sm"
                                                    className="text-slate-400 hover:text-red-500 hover:bg-red-50"
                                                    title={`Remove ${roleLabel.toLowerCase()}`}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <div className="group relative flex flex-col items-center justify-center py-12 p-4 md:p-5 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl transition-all">
                    <div className="h-12 w-12 bg-white rounded-full shadow-sm flex items-center justify-center mb-3 duration-200">
                        <Users className="h-6 w-6 text-slate-400" />
                    </div>
                    <p className="text-sm font-medium text-slate-500">No {roleLabel}{multiSelect ? "s" : ""} Selected</p>
                </div>
            )}

            {!isReadOnly && (
                <UserSelectionModal
                    isOpen={isModalOpen}
                    onClose={handleModalClose}
                    onConfirm={handleAddParticipants}
                    roleLabel={roleLabel}
            permissionCode={permissionCode}
            revisionId={revisionId}
                    multiSelect={multiSelect}
                    existingIds={participants.map((p) => p.id)}
                    excludedUserIds={excludedUserIds}
                />
            )}
        </div>
    );
};
