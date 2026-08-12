import React, { useState, useEffect } from 'react';
import { AlertModal } from '@/components/ui/modal/AlertModal';
import { Eye, EyeOff, Check, X, AlertTriangle, Calendar, Wand2, Lock, Key } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox/Checkbox';
import { Button } from '@/components/ui/button/Button';
import { cn } from '@/components/ui/utils';
import { WarningBanner } from '@/components/ui/banner/WarningBanner';
import { FormSection } from '@/components/ui/form/FormSection';
import { Badge } from '@/components/ui/badge/Badge';
import { authApi } from '@/services/api/auth';
import { IconCalendarEvent, IconPasswordUser, IconSparkles, IconWorldQuestion } from '@tabler/icons-react';

interface PasswordTabProps {
    passwordData: {
        newPassword: string;
        confirmPassword: string;
    };
    showPasswords: {
        new: boolean;
        confirm: boolean;
    };
    passwordErrors: {
        newPassword: string;
        confirmPassword: string;
    };
    logoutAllSessions: boolean;
    onPasswordChange: (field: 'newPassword' | 'confirmPassword', value: string) => void;
    onTogglePasswordVisibility: (field: 'new' | 'confirm') => void;
    onLogoutAllSessionsChange: (checked: boolean) => void;
    passwordChangedAt?: string;
}

export const PasswordTab: React.FC<PasswordTabProps> = ({
    passwordData,
    showPasswords,
    passwordErrors,
    logoutAllSessions,
    onPasswordChange,
    onTogglePasswordVisibility,
    onLogoutAllSessionsChange,
    passwordChangedAt,
}) => {
    const lastChangeText = passwordChangedAt || "Never";
    const [sessions, setSessions] = useState<{
        sessionId: string;
        device: string;
        ipAddress: string;
        lastActivity: string;
        current: boolean;
    }[]>([]);

    const loadSessions = async () => {
        try {
            const data = await authApi.getSessions();
            setSessions(data);
        } catch (error) {
            console.error('Failed to load active sessions', error);
        }
    };

    useEffect(() => {
        loadSessions();
    }, []);

    const validatePassword = (password: string) => {
        return {
            minLength: password.length >= 8,
            hasUpperCase: /[A-Z]/.test(password),
            hasLowerCase: /[a-z]/.test(password),
            hasNumber: /[0-9]/.test(password),
            hasSpecialChar: /[!@#$%^&*(),.?":{}|<>]/.test(password),
        };
    };

    const passwordRequirements = passwordData.newPassword ? validatePassword(passwordData.newPassword) : null;

    // Calculate days until password expiry (default 90 days after last change)
    const getExpiryTextAndDays = () => {
        if (!passwordChangedAt) return { text: 'N/A', days: 90 };
        const match = passwordChangedAt.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
        if (!match) return { text: 'N/A', days: 90 };
        const [, day, month, year] = match;
        const lastChangeDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        const expiryDate = new Date(lastChangeDate.getTime() + 90 * 24 * 60 * 60 * 1000);
        
        const today = new Date();
        const diffTime = expiryDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        const expMonth = String(expiryDate.getMonth() + 1).padStart(2, '0');
        const expDay = String(expiryDate.getDate()).padStart(2, '0');
        const expText = `${expiryDate.getFullYear()}-${expMonth}-${expDay}`;
        
        return { text: expText, days: diffDays };
    };

    const { text: expiryDateText, days: daysUntilExpiry } = getExpiryTextAndDays();
    const showExpiryWarning = daysUntilExpiry <= 30 && daysUntilExpiry > 0;

    // Password generator function
    const generatePassword = () => {
        const lowercase = 'abcdefghijklmnopqrstuvwxyz';
        const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const numbers = '0123456789';
        const special = '!@#$%^&*()';

        const allChars = lowercase + uppercase + numbers + special;
        let password = '';

        // Ensure at least one character from each category
        password += lowercase[Math.floor(Math.random() * lowercase.length)];
        password += uppercase[Math.floor(Math.random() * uppercase.length)];
        password += numbers[Math.floor(Math.random() * numbers.length)];
        password += special[Math.floor(Math.random() * special.length)];

        // Fill the rest randomly (total 12 characters)
        for (let i = 4; i < 12; i++) {
            password += allChars[Math.floor(Math.random() * allChars.length)];
        }

        // Shuffle the password
        password = password.split('').sort(() => Math.random() - 0.5).join('');

        onPasswordChange('newPassword', password);
        onPasswordChange('confirmPassword', password);
    };

    // State for session logout confirm modal
    const [logoutModal, setLogoutModal] = useState<{ open: boolean; sessionId: string | null }>({ open: false, sessionId: null });

    const handleLogoutSession = (sessionId: string) => {
        setLogoutModal({ open: true, sessionId });
    };

    const handleConfirmLogout = async () => {
        if (logoutModal.sessionId !== null) {
            try {
                await authApi.revokeSession(logoutModal.sessionId);
                await loadSessions();
            } catch (error) {
                console.error('Failed to revoke session', error);
            }
        }
        setLogoutModal({ open: false, sessionId: null });
    };

    return (
        <div className="space-y-6">
            {/* Logout Session Confirm Modal */}
            <AlertModal
                isOpen={logoutModal.open}
                onClose={() => setLogoutModal({ open: false, sessionId: null })}
                onConfirm={handleConfirmLogout}
                type="confirm"
                title="Log out this session?"
                description="Are you sure you want to log out this session? This device will be signed out immediately."
                confirmText="Log Out"
                cancelText="Cancel"
                showCancel
            />
            {/* Password Expiry Warning */}
            {showExpiryWarning && (
                <WarningBanner
                    variant="warning"
                    title="Password Expiration Warning"
                    description={
                        <span>
                            Your password will expire in <strong>{daysUntilExpiry} days</strong> (on {expiryDateText}). Please change your password soon to avoid account access issues.
                        </span>
                    }
                />
            )}

            {/* Two Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Column - Password Management */}
                <div className="space-y-6">
                    {/* Last Password Change Info */}
                    <div className="p-3 sm:p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-2 sm:gap-3">
                        <IconCalendarEvent className="h-4 w-4 sm:h-5 sm:w-5 text-slate-600 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                            <h4 className="text-xs sm:text-sm font-medium text-slate-900">Last Password Change</h4>
                            <p className="text-xs sm:text-sm text-slate-600 mt-0.5 truncate">{lastChangeText}</p>
                        </div>
                    </div>

                    {/* Change Password Section */}
                    <FormSection title="Change Password" icon={<IconPasswordUser className="h-4 w-4" />}>
                        <div className="space-y-4">
                            {/* New Password */}
                            <div>
                                <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">
                                    New Password <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                    <input
                                        type={showPasswords.new ? "text" : "password"}
                                        value={passwordData.newPassword}
                                        onChange={(e) => onPasswordChange('newPassword', e.target.value)}
                                        className={cn(
                                            "w-full h-9 px-3.5 pr-24 text-sm border rounded-lg bg-white focus:outline-none focus:ring-1 transition-all",
                                            passwordErrors.newPassword
                                                ? "border-red-300 focus:ring-red-500 focus:border-red-500"
                                                : "border-slate-200 focus:ring-emerald-500 focus:border-emerald-500"
                                        )}
                                        placeholder="Enter new password"
                                    />
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={generatePassword}
                                            className="text-emerald-600 hover:text-emerald-700 p-1"
                                            title="Generate strong password"
                                        >
                                            <IconSparkles  className="h-5 w-5" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => onTogglePasswordVisibility('new')}
                                            className="text-slate-400 hover:text-slate-600"
                                        >
                                            {showPasswords.new ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </button>
                                    </div>
                                </div>
                                {passwordErrors.newPassword && (
                                    <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
                                        <X className="h-3 w-3" />
                                        {passwordErrors.newPassword}
                                    </p>
                                )}
                            </div>

                            {/* Confirm New Password */}
                            <div>
                                <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">
                                    Confirm New Password <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                    <input
                                        type={showPasswords.confirm ? "text" : "password"}
                                        value={passwordData.confirmPassword}
                                        onChange={(e) => onPasswordChange('confirmPassword', e.target.value)}
                                        className={cn(
                                            "w-full h-9 px-3.5 pr-10 text-sm border rounded-lg bg-white focus:outline-none focus:ring-1 transition-all",
                                            passwordErrors.confirmPassword
                                                ? "border-red-300 focus:ring-red-500 focus:border-red-500"
                                                : "border-slate-200 focus:ring-emerald-500 focus:border-emerald-500"
                                        )}
                                        placeholder="Confirm new password"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => onTogglePasswordVisibility('confirm')}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                    >
                                        {showPasswords.confirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                                {passwordErrors.confirmPassword && (
                                    <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
                                        <X className="h-3 w-3" />
                                        {passwordErrors.confirmPassword}
                                    </p>
                                )}
                            </div>

                            {/* Password Strength */}
                            {passwordData.newPassword && (
                                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                                    <p className="text-xs sm:text-sm font-medium text-slate-700 mb-2">Password Strength:</p>
                                    <div className="space-y-1.5">
                                        {[
                                            { key: 'minLength', label: 'At least 8 characters' },
                                            { key: 'hasUpperCase', label: 'One uppercase letter (A-Z)' },
                                            { key: 'hasLowerCase', label: 'One lowercase letter (a-z)' },
                                            { key: 'hasNumber', label: 'One number (0-9)' },
                                            { key: 'hasSpecialChar', label: 'One special character (!@#$%^&*)' },
                                        ].map((req) => (
                                            <div
                                                key={req.key}
                                                className={cn(
                                                    "flex items-center gap-2 text-xs",
                                                    passwordRequirements?.[req.key as keyof typeof passwordRequirements] ? "text-emerald-600" : "text-slate-500"
                                                )}
                                            >
                                                {passwordRequirements?.[req.key as keyof typeof passwordRequirements] ? (
                                                    <Check className="h-3.5 w-3.5" />
                                                ) : (
                                                    <X className="h-3.5 w-3.5" />
                                                )}
                                                <span>{req.label}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                        {/* Password Options - Merged */}
                        <div className="pt-4 mt-2 flex items-start gap-2">
                            <Checkbox
                                id="logoutAllSessions"
                                checked={logoutAllSessions}
                                onChange={onLogoutAllSessionsChange}
                            />
                            <div className="flex-1">
                                <label htmlFor="logoutAllSessions" className="text-xs sm:text-sm font-medium text-slate-700 cursor-pointer block">
                                    Log out from all sessions after password change
                                </label>
                                <p className="text-xs text-slate-600 mt-0.5">
                                    When enabled, you will be logged out from all devices and browsers after successfully changing your password.
                                </p>
                            </div>
                        </div>
                    </FormSection>
                </div>

                {/* Right Column - Active Sessions */}
                <div>
                    <FormSection title="Active Sessions" icon={<IconWorldQuestion className="h-4 w-4" />}>
                        <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1.5 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-50 hover:scrollbar-thumb-slate-400">
                            {sessions.map((session) => (
                                <div key={session.sessionId} className="p-3 sm:p-4 bg-slate-50 rounded-lg border border-slate-200">
                                    <div className="flex items-start gap-2 sm:gap-3">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-1">
                                                <h4 className="text-xs sm:text-sm font-semibold text-slate-900">{session.device}</h4>
                                                {session.current && (
                                                    <Badge color="emerald" size="sm">Current</Badge>
                                                )}
                                            </div>
                                            <p className="text-2xs sm:text-xs text-slate-600 truncate">
                                                IP: {session.ipAddress} - Last active: {session.lastActivity}
                                            </p>
                                        </div>
                                        {!session.current && (
                                            <Button
                                                size="xs"
                                                variant="outline"
                                                onClick={() => handleLogoutSession(session.sessionId)}
                                                className="text-red-600 border-red-300 hover:bg-red-50 text-2xs sm:text-xs px-2 sm:px-3 whitespace-nowrap flex-shrink-0"
                                            >
                                                Log Out
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </FormSection>
                </div>
            </div>
        </div>
    );
};
