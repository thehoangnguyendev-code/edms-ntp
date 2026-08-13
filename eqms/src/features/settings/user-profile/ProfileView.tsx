import React, { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@/app/routes.constants';
import { Button } from '@/components/ui/button/Button';
import { TabNav } from '@/components/ui/tabs/TabNav';
import { cn } from '@/components/ui/utils';
import { useToast } from '@/components/ui/toast';
import { FullPageLoading } from "@/components/ui/loading/Loading";
import { PageHeader } from '@/components/ui/page/PageHeader';
import { myProfile } from '@/components/ui/breadcrumb/breadcrumbs/settings';
import { navigateBack } from '@/app/navigation/backNavigation';
import { AccountInfoTab } from "./AccountInfoTab";
import { PasswordTab } from "./PasswordTab";
import { authApi } from '@/services/api/auth';
import { resolveProfilePermissionState } from './profilePermissions';
import { useAuth } from '@/contexts/AuthContext';
import { isAvatarFileWithinLimit, isSupportedAvatarFile, readFileAsDataUrl } from '@/utils/avatar';
import { useTranslation } from '@/i18n';

interface ProfileViewProps {
    onBack?: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({ onBack }) => {
    const navigate = useNavigate();
    const { user: authUser, updateUser: updateAuthUser } = useAuth();
    const [activeTab, setActiveTab] = useState('account');
    const { showToast } = useToast();
    const { t } = useTranslation();
    const [avatarPreview, setAvatarPreview] = useState<string>('');
    const [originalAvatarPreview, setOriginalAvatarPreview] = useState<string>('');
    const [hasAvatarChanged, setHasAvatarChanged] = useState(false);
    const [isNavigating, setIsNavigating] = useState(false);
    const [isLoadingProfile, setIsLoadingProfile] = useState(true);

    // Password state
    const [passwordData, setPasswordData] = useState({
        newPassword: '',
        confirmPassword: '',
    });
    const [showPasswords, setShowPasswords] = useState({
        new: false,
        confirm: false,
    });
    const [passwordErrors, setPasswordErrors] = useState({
        newPassword: '',
        confirmPassword: '',
    });
    const [logoutAllSessions, setLogoutAllSessions] = useState(true);

    const [originalFormData, setOriginalFormData] = useState({
        fullName: '',
        username: '',
        employeeCode: '',
        position: '',
        department: '',
        businessUnit: '',
        employmentType: '',
        startDate: '',
        systemRole: '',
        nationality: '',
        userGroup: '',
        email: '',
        phone: '',
    });

    const [formData, setFormData] = useState(originalFormData);
    const [passwordChangedAt, setPasswordChangedAt] = useState('');

    // Editing state for contact fields
    const [editingFields, setEditingFields] = useState({
        email: false,
        phone: false,
    });

    const hasProfileChanges =
        formData.email !== originalFormData.email ||
        formData.phone !== originalFormData.phone ||
        hasAvatarChanged;

    const hasPasswordChanges =
        passwordData.newPassword !== '' ||
        passwordData.confirmPassword !== '';

    // Check if there are any meaningful changes (profile diff or password)
    const hasChanges =
        hasProfileChanges || hasPasswordChanges;

    // Permissions state
    const [permissions, setPermissions] = useState({
        printControlledCopy: false,
        viewAuditTrail: false,
        createTrainingTest: false,
        manageUsers: false,
        approveDocuments: false,
    });

    const loadProfile = async () => {
        try {
            setIsLoadingProfile(true);
            const user = await authApi.getCurrentUser();
            const data = {
                fullName: user.fullName || '',
                username: user.username || '',
                employeeCode: user.employeeCode || '',
                position: user.position || '',
                department: user.department || '',
                businessUnit: user.businessUnit || '',
                employmentType: user.employmentType || '',
                startDate: user.startDate || '',
                systemRole: user.role || '',
                nationality: user.nationality || '',
                userGroup: user.role || '',
                email: user.email || '',
                phone: user.phone || '',
            };
            setOriginalFormData(data);
            setFormData(data);
            if (user.avatar) {
                setAvatarPreview(user.avatar);
                setOriginalAvatarPreview(user.avatar);
            } else {
                setAvatarPreview('');
                setOriginalAvatarPreview('');
            }
            if (user.passwordChangedAt) {
                setPasswordChangedAt(user.passwordChangedAt);
            }
            setPermissions(resolveProfilePermissionState(user.permissions || []));
        } catch (error) {
            showToast({ type: 'error', title: t('userProfile.errorTitle'), message: t('userProfile.loadFailed') });
        } finally {
            setIsLoadingProfile(false);
        }
    };

    useEffect(() => {
        loadProfile();
    }, []);

    const handleInputChange = (field: string, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleAvatarChange = async (file: File) => {
        if (!isSupportedAvatarFile(file)) {
            showToast({ type: 'error', title: t('userProfile.errorTitle'), message: t('userProfile.avatarFileTypeInvalid') });
            return;
        }
        if (!isAvatarFileWithinLimit(file)) {
            showToast({ type: 'error', title: t('userProfile.errorTitle'), message: t('userProfile.avatarTooLarge') });
            return;
        }

        try {
            const dataUrl = await readFileAsDataUrl(file);
            setAvatarPreview(dataUrl);
            setHasAvatarChanged(true);
        } catch (error) {
            setAvatarPreview(originalAvatarPreview);
            setHasAvatarChanged(false);
            showToast({ type: 'error', title: t('userProfile.errorTitle'), message: t('userProfile.avatarUpdateFailed') });
        }
    };

    const handleToggleEdit = (field: 'email' | 'phone') => {
        setEditingFields(prev => ({ ...prev, [field]: !prev[field] }));
    };

    const handlePasswordChange = (field: 'newPassword' | 'confirmPassword', value: string) => {
        setPasswordData(prev => ({ ...prev, [field]: value }));
        setPasswordErrors(prev => ({ ...prev, [field]: '' }));
    };

    const togglePasswordVisibility = (field: 'new' | 'confirm') => {
        setShowPasswords(prev => ({ ...prev, [field]: !prev[field] }));
    };

    const validatePassword = (password: string) => {
        const requirements = {
            minLength: password.length >= 8,
            hasUpperCase: /[A-Z]/.test(password),
            hasLowerCase: /[a-z]/.test(password),
            hasNumber: /[0-9]/.test(password),
            hasSpecialChar: /[!@#$%^&*(),.?":{}|<>]/.test(password),
        };
        return requirements;
    };

    const handleSubmit = async () => {
        let hasError = false;
        const newErrors = {
            newPassword: '',
            confirmPassword: '',
        };

        // If user is changing password, validate it
        if (passwordData.newPassword || passwordData.confirmPassword) {
            if (!passwordData.newPassword) {
                newErrors.newPassword = 'New password is required';
                hasError = true;
            } else {
                const requirements = validatePassword(passwordData.newPassword);
                if (!Object.values(requirements).every(Boolean)) {
                    newErrors.newPassword = 'Password does not meet all requirements';
                    hasError = true;
                }
            }

            if (!passwordData.confirmPassword) {
                newErrors.confirmPassword = 'Please confirm your new password';
                hasError = true;
            } else if (passwordData.newPassword !== passwordData.confirmPassword) {
                newErrors.confirmPassword = 'Passwords do not match';
                hasError = true;
            }

            setPasswordErrors(newErrors);
        }

        if (hasError) return;

        try {
            setIsNavigating(true);

            const savePasswordChanges = async () => {
                if (!hasPasswordChanges) {
                    return;
                }

                await authApi.changePassword({
                    currentPassword: '',
                    newPassword: passwordData.newPassword,
                    confirmPassword: passwordData.confirmPassword,
                });

                if (logoutAllSessions) {
                    await authApi.revokeOtherSessions();
                }
            };

            const saveProfileChanges = async () => {
                if (!hasProfileChanges) {
                    return;
                }

                const profileUpdates: {
                    email?: string;
                    phone?: string;
                    avatar?: string;
                } = {};

                if (formData.email !== originalFormData.email) {
                    profileUpdates.email = formData.email;
                }
                if (formData.phone !== originalFormData.phone) {
                    profileUpdates.phone = formData.phone;
                }
                if (hasAvatarChanged) {
                    profileUpdates.avatar = avatarPreview;
                }

                const updated = await authApi.updateProfile(profileUpdates);

                if (updated.avatar !== undefined) {
                    setAvatarPreview(updated.avatar || '');
                    setOriginalAvatarPreview(updated.avatar || '');
                } else if (hasAvatarChanged) {
                    setOriginalAvatarPreview(avatarPreview);
                }

                if (authUser?.id === updated.id) {
                    updateAuthUser({ ...authUser, avatar: updated.avatar ?? avatarPreview });
                }
            };

            await savePasswordChanges();
            await saveProfileChanges();

            showToast({ type: 'success', title: t('userProfile.successTitle'), message: t('userProfile.saved') });
            
            await loadProfile();

            setPasswordData({
                newPassword: '',
                confirmPassword: '',
            });
            setHasAvatarChanged(false);
            setEditingFields({ email: false, phone: false });
        } catch (error) {
            console.error('Failed to save profile changes', error);
            showToast({ type: 'error', title: t('userProfile.errorTitle'), message: t('userProfile.saveFailed') });
        } finally {
            setIsNavigating(false);
        }
    };

    const handleCancel = () => {
        // Reset form data to original
        setFormData(originalFormData);
        // Reset editing states
        setEditingFields({ email: false, phone: false });
        // Reset password fields
        setPasswordData({ newPassword: '', confirmPassword: '' });
        setPasswordErrors({ newPassword: '', confirmPassword: '' });
        // Reset avatar
        setAvatarPreview(originalAvatarPreview);
        setHasAvatarChanged(false);
    };

    const handleBack = () => {
        setIsNavigating(true);
        setTimeout(() => {
            if (onBack) {
                onBack();
            } else {
                navigateBack(navigate, null, ROUTES.DASHBOARD);
            }
            setIsNavigating(false);
        }, 600);
    };

    if (isLoadingProfile) {
        return <FullPageLoading text="Loading user profile..." />;
    }

    return (
        <div className="space-y-4 sm:space-y-6 w-full flex-1 flex flex-col">
            <PageHeader
                title="My Profile"
                breadcrumbItems={myProfile(navigate)}
                actions={
                    <div className="flex items-center gap-2 md:gap-3 flex-wrap">
                        <Button
                            onClick={handleBack}
                            variant="outline-emerald"
                            size="sm"
                            className="whitespace-nowrap flex items-center gap-1.5 md:gap-2 touch-manipulation"
                        >
                            Back
                        </Button>
                        <Button
                            size='sm'
                            onClick={handleSubmit}
                            variant="outline-emerald"
                            disabled={!hasChanges}
                            className="whitespace-nowrap flex items-center gap-1.5 md:gap-2 touch-manipulation disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Save Changes
                        </Button>
                    </div>
                }
            />

            {/* Main Content Card */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                {/* Tab Navigation */}
                <TabNav
                    tabs={[
                        { id: 'account', label: 'Account' },
                        { id: 'password', label: 'Password' }
                    ]}
                    activeTab={activeTab}
                    onChange={setActiveTab}
                />

                {/* Content */}
                <div className="p-4 md:p-5">
                    {activeTab === 'account' && (
                        <AccountInfoTab
                            formData={formData}
                            permissions={permissions}
                            avatarPreview={avatarPreview}
                            editingFields={editingFields}
                            onInputChange={handleInputChange}
                            onAvatarChange={handleAvatarChange}
                            onToggleEdit={handleToggleEdit}
                        />
                    )}

                    {activeTab === 'password' && (
                        <PasswordTab
                            passwordData={passwordData}
                            showPasswords={showPasswords}
                            passwordErrors={passwordErrors}
                            logoutAllSessions={logoutAllSessions}
                            onPasswordChange={handlePasswordChange}
                            onTogglePasswordVisibility={togglePasswordVisibility}
                            onLogoutAllSessionsChange={setLogoutAllSessions}
                            passwordChangedAt={passwordChangedAt}
                        />
                    )}
                </div>
            </div>

            {/* Action Buttons Footer - Detached from card */}
            <div className="flex items-center gap-2 md:gap-3 flex-wrap mt-2 sm:mt-4">
                <Button
                    size='sm'
                    variant="outline-emerald"
                    onClick={handleCancel}
                    className="whitespace-nowrap flex items-center gap-1.5 md:gap-2 touch-manipulation"
                >
                    Cancel
                </Button>
                <Button
                    size='sm'
                    onClick={handleSubmit}
                    variant="outline-emerald"
                    disabled={!hasChanges}
                    className="whitespace-nowrap flex items-center gap-1.5 md:gap-2 touch-manipulation disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Save Changes
                </Button>
            </div>
            {isNavigating && <FullPageLoading text="Loading..." />}
        </div>
    );
};
