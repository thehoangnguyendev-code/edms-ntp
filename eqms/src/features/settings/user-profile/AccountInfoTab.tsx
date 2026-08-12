import React, { useRef, useState, ChangeEvent, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, User as UserIcon } from 'lucide-react';
import { Button } from '@/components/ui/button/Button';
import { Checkbox } from '@/components/ui/checkbox/Checkbox';
import { useToast } from '@/components/ui/toast';
import { FormSection } from '@/components/ui/form/FormSection';
import { IconAddressBook, IconPencilMinus } from '@tabler/icons-react';
import { type ProfilePermissionState } from './profilePermissions';
import { AvatarCropModal } from './AvatarCropModal';
import { CONTROL_STATE_CLASSES } from "@/components/ui/controlState";

interface AccountInfoTabProps {
    formData: {
        fullName: string;
        username: string;
        employeeCode: string;
        position: string;
        department: string;
        businessUnit: string;
        employmentType: string;
        startDate: string;
        systemRole: string;
        nationality: string;
        userGroup: string;
        email: string;
        phone: string;
    };
    permissions: ProfilePermissionState;
    avatarPreview: string;
    editingFields: {
        email: boolean;
        phone: boolean;
    };
    onInputChange: (field: string, value: string) => void;
    onAvatarChange: (file: File) => void;
    onToggleEdit: (field: 'email' | 'phone') => void;
    // Verification status
    emailVerified?: boolean;
    phoneVerified?: boolean;
}

export const AccountInfoTab: React.FC<AccountInfoTabProps> = ({
    formData,
    permissions,
    avatarPreview,
    editingFields,
    onInputChange,
    onAvatarChange,
    onToggleEdit,
    emailVerified = true,
    phoneVerified = false,
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { showToast } = useToast();

    // Crop modal state
    const [cropModalOpen, setCropModalOpen] = useState(false);
    const [imageToCrop, setImageToCrop] = useState<string>('');
    const navigate = useNavigate();

    const handleAvatarClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            // Validate file size (5MB)
            if (file.size > 5 * 1024 * 1024) {
                showToast({ type: 'error', title: 'Error', message: 'File size exceeds 5MB limit.' });
                return;
            }
            // Validate file type
            if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.type)) {
                showToast({ type: 'error', title: 'Error', message: 'Only .png or .jpg files are accepted.' });
                return;
            }

            // Open crop modal with the selected image
            const objectUrl = URL.createObjectURL(file);
            setImageToCrop(objectUrl);
            setCropModalOpen(true);
        }
        // Reset input value to allow re-selecting the same file
        e.target.value = '';
    };

    const handleCropComplete = useCallback((croppedBlob: Blob) => {
        // Revoke old object URL to free memory
        if (imageToCrop) URL.revokeObjectURL(imageToCrop);

        const croppedFile = new File([croppedBlob], 'avatar.jpg', { type: 'image/jpeg' });
        onAvatarChange(croppedFile);
        setCropModalOpen(false);
    }, [imageToCrop, onAvatarChange]);

    const handleCropClose = useCallback(() => {
        if (imageToCrop) URL.revokeObjectURL(imageToCrop);
        setImageToCrop('');
        setCropModalOpen(false);
    }, [imageToCrop]);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
            {/* Left Column - Avatar Section */}
            <div className="lg:col-span-3">
                <div className="flex flex-col items-center">
                    {/* Avatar */}
                    <div className="relative group">
                        <div className="h-32 w-32 sm:h-40 sm:w-40 lg:h-48 lg:w-48 rounded-full bg-slate-100 overflow-hidden border-2 border-slate-200 flex items-center justify-center">
                            {avatarPreview ? (
                                <img
                                    src={avatarPreview}
                                    alt="User Avatar"
                                    className="h-full w-full object-cover"
                                    onError={(e) => {
                                        e.currentTarget.style.display = 'none';
                                        e.currentTarget.parentElement!.innerHTML = '<div class="h-full w-full flex items-center justify-center bg-emerald-50"><svg class="h-16 w-16 sm:h-20 sm:w-20 lg:h-24 lg:w-24 text-emerald-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg></div>';
                                    }}
                                />
                            ) : (
                                <UserIcon className="h-16 w-16 sm:h-20 sm:w-20 lg:h-24 lg:w-24 text-emerald-600" strokeWidth={1.5} />
                            )}
                        </div>
                        {/* Camera Button */}
                        <button
                            onClick={handleAvatarClick}
                            type="button"
                            className="absolute bottom-1 right-1 sm:bottom-2 sm:right-2 h-9 w-9 sm:h-10 sm:w-10 lg:h-11 lg:w-11 rounded-full bg-white border-2 border-slate-200 shadow-md flex items-center justify-center hover:bg-emerald-50 hover:border-emerald-500 transition-all duration-200 cursor-pointer"
                            title="Change avatar"
                        >
                            <Camera className="h-4 w-4 sm:h-4.5 sm:w-4.5 lg:h-5 lg:w-5 text-slate-700" strokeWidth={2} />
                        </button>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".png,.jpg,.jpeg"
                            className="hidden"
                            onChange={handleFileChange}
                        />
                    </div>

                    {/* Upload Info */}
                    <div className="mt-3 sm:mt-4 text-center">
                        <p className="text-xs text-slate-500 leading-relaxed">
                            Allowed: <span className="font-medium text-slate-700">.PNG, .JPG</span>
                        </p>
                        <p className="text-xs text-slate-500">
                            Max size: <span className="font-medium text-slate-700">5MB</span>
                        </p>
                    </div>

                    {/* Privacy Link */}
                    <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-slate-200 w-full flex justify-center">
                        <button
                            type="button"
                            onClick={() => navigate('/profile/data-privacy')}
                            className="text-xs text-emerald-600 hover:text-emerald-700 hover:underline inline-flex items-center gap-1"
                        >
                            <span>Data Privacy Request</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Right Column - Form Fields */}
            <div className="lg:col-span-9">
                <div className="space-y-6">
                    {/* Basic Information Section */}
                    <FormSection title="Basic Information" icon={<UserIcon className="h-4 w-4" />}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">Full Name</label>
                                <input type="text" value={formData.fullName} readOnly className={CONTROL_STATE_CLASSES.readonlyFieldCompact} />
                            </div>
                            <div>
                                <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">Username</label>
                                <input type="text" value={formData.username} readOnly className={CONTROL_STATE_CLASSES.readonlyFieldCompact} />
                            </div>
                            <div>
                                <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">Employee ID</label>
                                <input type="text" value={formData.employeeCode} readOnly className={CONTROL_STATE_CLASSES.readonlyFieldCompact} />
                            </div>
                            <div>
                                <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">Nationality</label>
                                <input type="text" value={formData.nationality} readOnly className={CONTROL_STATE_CLASSES.readonlyFieldCompact} />
                            </div>
                            <div>
                                <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">Position</label>
                                <input type="text" value={formData.position} readOnly className={CONTROL_STATE_CLASSES.readonlyFieldCompact} />
                            </div>
                            <div>
                                <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">Department</label>
                                <input type="text" value={formData.department} readOnly className={CONTROL_STATE_CLASSES.readonlyFieldCompact} />
                            </div>
                            <div>
                                <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">Business Unit</label>
                                <input type="text" value={formData.businessUnit} readOnly className={CONTROL_STATE_CLASSES.readonlyFieldCompact} />
                            </div>
                            <div>
                                <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">Employment Type</label>
                                <input type="text" value={formData.employmentType} readOnly className={CONTROL_STATE_CLASSES.readonlyFieldCompact} />
                            </div>
                            <div>
                                <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">Start Date</label>
                                <input type="text" value={formData.startDate} readOnly className={CONTROL_STATE_CLASSES.readonlyFieldCompact} />
                            </div>
                            <div>
                                <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">Access Profiles</label>
                                <input type="text" value={formData.systemRole} readOnly className={CONTROL_STATE_CLASSES.readonlyFieldCompact} />
                            </div>
                        </div>
                    </FormSection>

                    {/* Contact Information Section */}
                    <FormSection title="Contact Information" icon={<IconAddressBook className="h-4 w-4" />}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">
                                    Email Address <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                    <input
                                        type="email"
                                        value={formData.email}
                                        onChange={(e) => onInputChange('email', e.target.value)}
                                        disabled={!editingFields.email}
                                        className={`w-full h-9 px-3.5 pr-10 text-sm border rounded-lg transition-all focus:outline-none ${editingFields.email
                                            ? 'border-emerald-500 bg-white ring-1 ring-emerald-500 focus:ring-emerald-500 focus:border-emerald-500'
                                            : 'border-slate-200 bg-slate-100 text-slate-600 cursor-not-allowed'
                                            }`}
                                        placeholder="Enter email"
                                    />
                                    <Button
                                        variant="ghost"
                                        size="icon-sm"
                                        className={`absolute right-1 top-1/2 -translate-y-1/2 text-emerald-600 bg-transparent hover:bg-transparent focus:bg-transparent active:bg-transparent ${editingFields.email
                                            ? 'text-emerald-700'
                                            : 'hover:text-emerald-700'
                                            }`}
                                        title={editingFields.email ? 'Editing email' : 'Edit email'}
                                        onClick={() => onToggleEdit('email')}
                                    >
                                        <IconPencilMinus className="h-4 w-4" />
                                    </Button>
                                </div>
                                {/* Email Verification Status */}
                                <div className="mt-1.5 flex items-center gap-1.5">
                                    {emailVerified ? (
                                        <>
                                            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                                                <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                                </svg>
                                                Verified
                                            </span>
                                        </>
                                    ) : (
                                        <>
                                            <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600">
                                                <svg className="h-3.5 w-3.5 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                                                </svg>
                                                Pending verification
                                            </span>
                                        </>
                                    )}
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">
                                    Phone Number <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                    <input
                                        type="tel"
                                        value={formData.phone}
                                        onChange={(e) => onInputChange('phone', e.target.value)}
                                        disabled={!editingFields.phone}
                                        className={`w-full h-9 px-3.5 pr-10 text-sm border rounded-lg transition-all focus:outline-none ${editingFields.phone
                                            ? 'border-emerald-500 bg-white ring-1 ring-emerald-500 focus:ring-emerald-500 focus:border-emerald-500'
                                            : 'border-slate-200 bg-slate-100 text-slate-600 cursor-not-allowed'
                                            }`}
                                        placeholder="Enter phone number"
                                    />
                                    <Button
                                        variant="ghost"
                                        size="icon-sm"
                                        className={`absolute right-1 top-1/2 -translate-y-1/2 text-emerald-600 bg-transparent hover:bg-transparent focus:bg-transparent active:bg-transparent ${editingFields.phone
                                            ? 'text-emerald-700'
                                            : 'hover:text-emerald-700'
                                            }`}
                                        title={editingFields.phone ? 'Editing phone' : 'Edit phone'}
                                        onClick={() => onToggleEdit('phone')}
                                    >
                                        <IconPencilMinus className="h-4 w-4" />
                                    </Button>
                                </div>
                                {/* Phone Verification Status */}
                                <div className="mt-1.5 flex items-center gap-1.5">
                                    {phoneVerified ? (
                                        <>
                                            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                                                <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                                </svg>
                                                Verified
                                            </span>
                                        </>
                                    ) : (
                                        <>
                                            <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600">
                                                <svg className="h-3.5 w-3.5 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                                                </svg>
                                                Pending verification
                                            </span>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </FormSection>
                </div>
            </div>

            {/* Avatar Crop Modal */}
            <AvatarCropModal
                imageSrc={imageToCrop}
                isOpen={cropModalOpen}
                onClose={handleCropClose}
                onCropComplete={handleCropComplete}
            />
        </div>
    );
};
