import React, { useState, useEffect } from "react";
import { CheckCircle, Plus, Trash2, Search, User, X, ShieldCheck, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge/Badge";
import { Button } from "@/components/ui/button/Button";
import { cn } from "@/components/ui/utils";
import { FormModal } from "@/components/ui/modal/FormModal";
import { metadataApi } from "@/services/api/metadata";

import { Approver } from "./types";

interface AppUser {
    id: string;
    employeeCode: string;
    fullName: string;
    username: string;
    email: string;
    position: string;
    department: string;
}

interface ApproversTabProps {
    onCountChange?: (count: number) => void;
    isModalOpen?: boolean;
    onModalClose?: () => void;
    approvers?: Approver[];
    onApproversChange?: (approvers: Approver[]) => void;
}

interface UserSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (user: AppUser) => void;
}

const UserSelectionModal: React.FC<UserSelectionModalProps> = ({ isOpen, onClose, onSelect }) => {
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedId, setSelectedId] = useState<string>("");
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
            setSelectedId("");
            setIsLoading(true);
            // Ungated metadata lookup, not the settings.user.view-gated admin user list —
            // any user assembling a document's approver roster needs to pick colleagues
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
        setSelectedId(prev => prev === userId ? "" : userId);
    };

    const handleSave = () => {
        if (selectedId) {
            const selectedUser = users.find(u => u.id === selectedId);
            if (selectedUser) {
                onSelect(selectedUser);
                onClose();
            }
        }
    };

    return (
        <FormModal
            isOpen={isOpen}
            onClose={onClose}
            onConfirm={handleSave}
            title="Setup Approver"
            description="Select the final approver for this document."
            confirmText="Commit Selection"
            confirmDisabled={!selectedId}
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
                            <p className="text-xs text-slate-500 mt-1">Please wait while we load approver candidates</p>
                        </div>
                    ) : filteredUsers.length > 0 ? (
                        <div className="space-y-2">
                            {filteredUsers.map((user, index) => {
                                const isSelected = selectedId === user.id;

                                return (
                                    <button
                                        key={user.id}
                                        onClick={() => handleToggleUser(user.id)}
                                        className={cn(
                                            "w-full flex items-center gap-3 py-2.5 px-3 rounded-lg transition-all group text-left border",
                                            isSelected
                                                ? "bg-emerald-50 border-emerald-200 shadow-sm"
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
                                            <div className="font-medium text-slate-900 truncate text-xs md:text-sm">
                                                {user.fullName}
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

export const ApproversTab: React.FC<ApproversTabProps> = ({
    onCountChange,
    isModalOpen: externalModalOpen,
    onModalClose: externalModalClose,
    approvers: externalApprovers,
    onApproversChange: externalOnApproversChange,
}) => {
    const [internalApprovers, setInternalApprovers] = useState<Approver[]>([]);
    const [internalModalOpen, setInternalModalOpen] = useState(false);

    // Use external or internal state
    const approvers = externalApprovers ?? internalApprovers;
    const setApprovers = (newApprovers: Approver[]) => {
        if (externalOnApproversChange) {
            externalOnApproversChange(newApprovers);
        } else {
            setInternalApprovers(newApprovers);
        }
    };

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
        onCountChange?.(approvers.length);
    }, [approvers.length, onCountChange]);

    const handleSelectUser = (user: AppUser) => {
        const newApprover: Approver = {
            id: user.id,
            fullName: user.fullName,
            username: user.username,
            position: user.position,
            email: user.email,
            department: user.department
        };
        // Since only 1 approver is allowed, we replace the existing one or add if empty
        setApprovers([newApprover]);
    };

    const removeApprover = () => {
        setApprovers([]);
    };

    return (
        <div className="space-y-4">
            {approvers.length > 0 ? (
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
                                        Role
                                    </th>
                                    <th className="py-2.5 px-2 sm:py-3.5 sm:px-4 text-center text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap w-16 sm:w-24">
                                        Action
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 bg-white">
                                {approvers.map((approver, index) => (
                                    <tr key={approver.id} className="hover:bg-slate-50/80 transition-colors">
                                        <td className="py-2 px-2 sm:py-3.5 sm:px-4 text-xs sm:text-sm text-slate-500 whitespace-nowrap text-center font-medium">
                                            {index + 1}
                                        </td>
                                        <td className="py-2 px-2 sm:py-3.5 sm:px-4 text-xs sm:text-sm whitespace-nowrap">
                                            <div className="flex items-center gap-2 sm:gap-3">
                                                <div>
                                                    <div className="font-medium text-slate-900">{approver.fullName}</div>
                                                    <div className="text-2xs text-slate-500">{approver.username}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-2 px-2 sm:py-3.5 sm:px-4 text-xs sm:text-sm text-slate-600 whitespace-nowrap">
                                            {approver.email}
                                        </td>
                                        <td className="py-2 px-2 sm:py-3.5 sm:px-4 text-xs sm:text-sm text-slate-600 whitespace-nowrap">
                                            {approver.position}
                                        </td>
                                        <td className="py-2 px-2 sm:py-3.5 sm:px-4 text-xs sm:text-sm text-slate-600 whitespace-nowrap">
                                            {approver.department}
                                        </td>
                                        <td className="py-2 px-2 sm:py-3.5 sm:px-4 text-xs sm:text-sm whitespace-nowrap">
                                            <Badge color="emerald" size="sm">
                                                Approver
                                            </Badge>
                                        </td>
                                        <td className="py-2 px-2 sm:py-3.5 sm:px-4 text-center whitespace-nowrap">
                                            <Button
                                                onClick={removeApprover}
                                                variant="ghost"
                                                size="icon-sm"
                                                className="text-slate-400 hover:text-red-500 hover:bg-red-50"
                                                title="Remove approver"
                                            >
                                                <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
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
                    <div className="h-12 w-12 bg-white rounded-full shadow-sm flex items-center justify-center mb-3">
                        <User className="h-6 w-6 text-slate-400" />
                    </div>
                    <p className="text-sm font-medium text-slate-500">No Approver Selected</p>
                </div>
            )}

            <UserSelectionModal
                isOpen={isModalOpen}
                onClose={handleModalClose}
                onSelect={handleSelectUser}
            />
        </div>
    );
};
