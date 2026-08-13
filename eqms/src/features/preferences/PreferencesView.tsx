import React, { useCallback, useEffect, useState } from 'react';
import { Globe, BellRing, ShieldCheck, ChevronLeft } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button/Button';
import { TabNav, TabItem } from '@/components/ui/tabs/TabNav';
import { PageHeader } from '@/components/ui/page/PageHeader';
import breadcrumbs from '@/components/ui/breadcrumb/breadcrumbs.config';
import { useToast } from '@/components/ui/toast';
import { FullPageLoading } from "@/components/ui/loading/Loading";
import { LocalizationTab } from "./components/LocalizationTab";
import { NotificationSettingsTab } from "./components/NotificationSettingsTab";
import { SecuritySettingsTab } from "./components/SecuritySettingsTab";
import { PreferenceTabId } from "./types";
import { useTranslation } from '@/i18n';

export const PreferencesView: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const getTabFromSearchParams = (): PreferenceTabId => {
        const tab = searchParams.get('tab');
        return tab === 'localization' || tab === 'notifications' || tab === 'security'
            ? tab
            : 'localization';
    };
    const [activeTab, setActiveTab] = useState<PreferenceTabId>(getTabFromSearchParams);
    const [mobileListView, setMobileListView] = useState<boolean>(() => !searchParams.get('tab'));
    const { showToast } = useToast();
    const { t } = useTranslation();
    const [isSaving, setIsSaving] = useState(false);
    const [saveHandler, setSaveHandler] = useState<null | (() => Promise<void>)>(null);
    const [resetHandler, setResetHandler] = useState<null | (() => void)>(null);
  // Wrap setSaveHandler so React doesn't treat the passed function as a state updater.
  const registerSaveHandler = useCallback((handler: (() => Promise<void>) | null) => {
    setSaveHandler(() => handler);
  }, []);
  const registerResetHandler = useCallback((handler: (() => void) | null) => {
    setResetHandler(() => handler);
  }, []);
    const [resetVersion, setResetVersion] = useState(0);

    useEffect(() => {
        setActiveTab(getTabFromSearchParams());
    }, [searchParams]);

    const TABS: TabItem[] = [
        { id: 'localization', label: 'Localization', icon: Globe },
        { id: 'notifications', label: 'Notifications', icon: BellRing },
        { id: 'security', label: 'Security', icon: ShieldCheck },
    ];

    const handleSave = async () => {
        setIsSaving(true);
        try {
            if (saveHandler) {
                await saveHandler();
                showToast({ type: 'success', title: t('preferences.successTitle'), message: t('preferences.updated') });
                return;
            }

            showToast({ type: 'success', title: t('preferences.successTitle'), message: t('preferences.updated') });
        } catch (error) {
            showToast({
                type: 'error',
                title: t('preferences.errorTitle'),
                message: error instanceof Error ? error.message : t('preferences.updateFailed'),
            });
        } finally {
            setIsSaving(false);
        }
    };

    const renderTabContent = () => {
        switch (activeTab) {
            case 'localization':
                return <LocalizationTab onRegisterSaveHandler={registerSaveHandler} onRegisterResetHandler={registerResetHandler} />;
            case 'notifications':
                return <NotificationSettingsTab onRegisterSaveHandler={registerSaveHandler} />;
            case 'security':
                return <SecuritySettingsTab onRegisterSaveHandler={registerSaveHandler} />;
            default:
                return null;
        }
    };

    return (
        <div className="space-y-4 md:space-y-6 w-full flex-1 flex flex-col">
            {/* Header */}
            <PageHeader
                title="Preferences"
                breadcrumbItems={breadcrumbs.preferences(navigate, TABS.find(t => t.id === activeTab)?.label)}
                actions={
                    <>
                        <Button
                            variant="outline-emerald"
                            size="sm"
                            onClick={() => {
                                if (resetHandler) {
                                    resetHandler();
                                    showToast({ type: 'success', title: t('preferences.resetTitle'), message: t('preferences.resetLocalization') });
                                    return;
                                }
                                setResetVersion((value) => value + 1);
                            }}
                        >
                            Reset to Default
                        </Button>
                        <Button
                            variant="outline-emerald"
                            size="sm"
                            onClick={handleSave}
                            className="min-w-[120px]"
                        >
                            Save Changes
                        </Button>
                    </>
                }
            />

            {/* Main Content Card */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex-1 md:flex md:items-stretch">
                <div className={`md:w-72 md:shrink-0 md:border-r md:border-slate-200 p-2 md:p-3 ${mobileListView ? 'block' : 'hidden md:block'}`}>
                    <TabNav
                        variant="vertical"
                        tabs={TABS}
                        activeTab={activeTab}
                        onChange={(id) => {
                            const nextTab = id as PreferenceTabId;
                            setActiveTab(nextTab);
                            setSearchParams(nextTab === 'localization' ? {} : { tab: nextTab }, { replace: true });
                            setMobileListView(false);
                        }}
                        ariaLabel="Preference sections"
                        compactVertical
                    />
                </div>
                <div className={mobileListView ? "hidden md:block min-w-0 flex-1" : "block min-w-0 flex-1"}>
                    <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3 md:hidden">
                        <button
                            type="button"
                            onClick={() => setMobileListView(true)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
                            aria-label="Back to preferences list"
                        >
                            <ChevronLeft className="h-5 w-5" />
                        </button>
                        <p className="text-sm font-semibold text-slate-900">
                            {TABS.find((tab) => tab.id === activeTab)?.label}
                        </p>
                    </div>
                    <AnimatePresence mode="wait" initial={false}>
                        <motion.div
                            key={`${activeTab}-${resetVersion}`}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                            className="p-4 md:p-5"
                        >
                            {renderTabContent()}
                        </motion.div>
                    </AnimatePresence>
                </div>
            </div>

            {isSaving && <FullPageLoading text="Saving changes..." />}
        </div>
    );
};
