import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Lock, Shield, Pencil } from 'lucide-react';
import { PageHeader } from '@/components/ui/page/PageHeader';
import { Button } from '@/components/ui/button/Button';
import { TabNav, type TabItem } from '@/components/ui/tabs/TabNav';
import { FullPageLoading } from '@/components/ui/loading/Loading';
import { WarningBanner } from '@/components/ui/banner/WarningBanner';
import { ButtonLoading } from '@/components/ui/loading/Loading';
import { useToast } from '@/components/ui/toast/Toast';
import { usePermissions } from '@/hooks/usePermissions';
import { ROUTES } from '@/app/routes.constants';
import { PolicyStatusBadge, type TemplateEditorValue } from '@/components/ui/notification-content';
import {
  notificationPolicyApi,
  type NotificationPolicyDetail,
  type NotificationTemplateVersion,
  type RecipientRule,
  type DigestMode,
} from '@/services/api/notificationPolicy';
import {
  notificationPolicyDetail as notificationPolicyDetailBreadcrumb,
  notificationPolicyEdit as notificationPolicyEditBreadcrumb,
} from '@/components/ui/breadcrumb/breadcrumbs/settings';
import { GeneralTab } from './tabs/GeneralTab';
import { RecipientsTab } from './tabs/RecipientsTab';
import { DeliveryTab } from './tabs/DeliveryTab';
import { ContentTab } from './tabs/ContentTab';
import { PreviewHistoryTab } from './tabs/PreviewHistoryTab';

const TABS: TabItem[] = [
  { id: 'general', label: 'General' },
  { id: 'recipients', label: 'Recipients' },
  { id: 'delivery', label: 'Delivery' },
  { id: 'content', label: 'Content' },
  { id: 'preview', label: 'Preview & History' },
];

const emptyTemplateValue: TemplateEditorValue = { title: '', summary: '', actionUrlTemplate: '' };

const toTemplateValue = (version?: NotificationTemplateVersion | null): TemplateEditorValue => ({
  title: version?.title ?? '',
  summary: version?.summary ?? '',
  actionUrlTemplate: version?.actionUrlTemplate ?? '',
});

interface NotificationPolicyDetailViewProps {
  /** 'view' is always read-only, regardless of permission; 'edit' allows saving and requires manage permission. */
  mode?: 'view' | 'edit';
}

export const NotificationPolicyDetailView: React.FC<NotificationPolicyDetailViewProps> = ({ mode = 'view' }) => {
  const { eventCode = '' } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { hasPermissionAlias } = usePermissions();
  const canManage = hasPermissionAlias('settings.notification_policy.manage');
  const isEdit = mode === 'edit';

  const [detail, setDetail] = useState<NotificationPolicyDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(() => searchParams.get('tab') || 'general');
  const [isSaving, setIsSaving] = useState(false);

  const [status, setStatus] = useState<'ACTIVE' | 'DRAFT' | 'DISABLED'>('ACTIVE');
  const [recipientRules, setRecipientRules] = useState<RecipientRule[]>([]);
  const [digestMode, setDigestMode] = useState<DigestMode>('IMMEDIATE');
  const [quietHoursStart, setQuietHoursStart] = useState('');
  const [quietHoursEnd, setQuietHoursEnd] = useState('');
  const [escalationEnabled, setEscalationEnabled] = useState(false);
  const [escalationAfterMinutes, setEscalationAfterMinutes] = useState<number | ''>('');
  const [escalationRecipientRules, setEscalationRecipientRules] = useState<RecipientRule[]>([]);

  const [content, setContent] = useState<TemplateEditorValue>(emptyTemplateValue);
  const [previewResult, setPreviewResult] = useState<{ title: string | null; summary: string | null }>({ title: null, summary: null });
  const [history, setHistory] = useState<NotificationTemplateVersion[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const loadDetail = useCallback(() => {
    setIsLoading(true);
    notificationPolicyApi
      .getDetail(eventCode)
      .then((data) => {
        setDetail(data);
        setStatus(data.policyStatus);
        setRecipientRules(data.recipientRules ?? []);
        setDigestMode(data.digestMode);
        setQuietHoursStart(data.quietHoursStart ?? '');
        setQuietHoursEnd(data.quietHoursEnd ?? '');
        setEscalationEnabled(data.escalationEnabled);
        setEscalationAfterMinutes(data.escalationAfterMinutes ?? '');
        setEscalationRecipientRules(data.escalationRecipientRules ?? []);
        setContent(toTemplateValue(data.activeTemplates[0]));
      })
      .catch(() => {
        showToast({ type: 'error', title: 'Failed to load', message: 'Unable to load this notification policy.' });
      })
      .finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventCode]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  const isDirty = useMemo(() => {
    if (!isEdit || !detail) return false;
    if (status !== detail.policyStatus) return true;
    if (JSON.stringify(recipientRules) !== JSON.stringify(detail.recipientRules ?? [])) return true;
    if (digestMode !== detail.digestMode) return true;
    if (quietHoursStart !== (detail.quietHoursStart ?? '')) return true;
    if (quietHoursEnd !== (detail.quietHoursEnd ?? '')) return true;
    if (escalationEnabled !== detail.escalationEnabled) return true;
    if (escalationAfterMinutes !== (detail.escalationAfterMinutes ?? '')) return true;
    if (JSON.stringify(escalationRecipientRules) !== JSON.stringify(detail.escalationRecipientRules ?? [])) return true;
    if (JSON.stringify(toTemplateValue(detail.activeTemplates[0])) !== JSON.stringify(content)) return true;
    return false;
  }, [isEdit, detail, status, recipientRules, digestMode, quietHoursStart, quietHoursEnd, escalationEnabled, escalationAfterMinutes, escalationRecipientRules, content]);

  const handleSave = async () => {
    if (!detail) return;
    setIsSaving(true);
    try {
      // Persist the template first. A policy may only become ACTIVE after its in-app wording is
      // valid, so saving the previous order made a first-time activation fail unnecessarily.
      if (JSON.stringify(toTemplateValue(detail.activeTemplates[0])) !== JSON.stringify(content)) {
        await notificationPolicyApi.updateTemplate(eventCode, {
          title: content.title || null,
          summary: content.summary || null,
          actionUrlTemplate: content.actionUrlTemplate || null,
          changeSummary: 'Updated via Notification Policy screen',
        });
      }

      await notificationPolicyApi.updatePolicy(eventCode, {
        status,
        recipientRules,
        digestMode,
        // Empty strings deliberately clear an existing value; null means "leave unchanged" in the API.
        quietHoursStart,
        quietHoursEnd,
        escalationEnabled,
        escalationAfterMinutes: escalationAfterMinutes === '' ? null : Number(escalationAfterMinutes),
        escalationRecipientRules,
      });

      showToast({ type: 'success', title: 'Saved', message: 'Notification policy updated successfully.' });
      loadDetail();
    } catch (error: any) {
      showToast({
        type: 'error',
        title: 'Save failed',
        message: error?.response?.data?.message || error?.response?.data?.error?.message || 'Unable to save changes.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const runPreview = useCallback(() => {
    notificationPolicyApi
      .preview(eventCode, {
        title: content.title || undefined,
        summary: content.summary || undefined,
        actionUrlTemplate: content.actionUrlTemplate || undefined,
      })
      .then((result) => {
        setPreviewResult({ title: result.renderedTitle, summary: result.renderedSummary });
      })
      .catch(() => {
        showToast({ type: 'error', title: 'Preview failed', message: 'Unable to render the preview.' });
      });
  }, [content, eventCode, showToast]);

  useEffect(() => {
    if (activeTab === 'preview' && detail) {
      runPreview();
      setIsLoadingHistory(true);
      notificationPolicyApi
        .getHistory(eventCode)
        .then(setHistory)
        .catch(() => setHistory([]))
        .finally(() => setIsLoadingHistory(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, detail]);

  const handleRestore = async (versionId: string) => {
    try {
      await notificationPolicyApi.restoreVersion(eventCode, versionId);
      showToast({ type: 'success', title: 'Restored', message: 'Content restored from a previous version.' });
      loadDetail();
    } catch {
      showToast({ type: 'error', title: 'Restore failed', message: 'Unable to restore this version.' });
    }
  };

  if (isEdit && !canManage) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-slate-500">
        <Shield className="h-12 w-12 text-slate-300" />
        <p className="text-lg font-semibold">Access Denied</p>
        <p className="text-sm">You do not have permission to edit notification events.</p>
      </div>
    );
  }

  if (isLoading || !detail) {
    return <FullPageLoading text="Loading notification policy..." />;
  }

  const readOnly = !isEdit;
  const mandatoryLocksDelivery = detail.mandatory;
  const detailUrl = `${ROUTES.SETTINGS.NOTIFICATION_POLICY}/${eventCode}`;

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <PageHeader
        title={detail.name}
        breadcrumbItems={
          isEdit
            ? notificationPolicyEditBreadcrumb(navigate, detail.name, eventCode)
            : notificationPolicyDetailBreadcrumb(navigate, detail.name)
        }
        actions={
          <>
            <Button
              variant="outline-emerald"
              size="sm"
              onClick={() => navigate(isEdit ? detailUrl : ROUTES.SETTINGS.NOTIFICATION_POLICY)}
              className="whitespace-nowrap"
            >
              Back
            </Button>
            {isEdit ? (
              <Button
                size="sm"
                variant="outline-emerald"
                onClick={() => void handleSave()}
                disabled={isSaving || !isDirty}
                className="whitespace-nowrap"
              >
                {isSaving ? <ButtonLoading text="Saving…" /> : 'Save'}
              </Button>
            ) : (
              canManage && (
                <Button size="sm" variant="outline-emerald" onClick={() => navigate(`${detailUrl}/edit`)} className="gap-2 whitespace-nowrap">
                  Edit Notification
                </Button>
              )
            )}
          </>
        }
      />

      {isDirty && isEdit && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
          You have unsaved changes. Click Save to apply them, or navigate away to discard.
        </div>
      )}

      {detail.mandatory && (
        <WarningBanner
          variant="warning"
          title="This event is GMP-mandatory"
          description={detail.mandatoryReason || 'Required recipients for this event are locked and cannot be changed.'}
          icon={<Lock className="h-5 w-5" />}
        />
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <TabNav tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />
        <div className="p-4 md:p-5">
          {activeTab === 'general' && <GeneralTab detail={detail} status={status} onStatusChange={setStatus} readOnly={readOnly} />}

          {activeTab === 'recipients' && (
            <RecipientsTab value={recipientRules} onChange={setRecipientRules} disabled={readOnly || mandatoryLocksDelivery} mandatoryLocked={mandatoryLocksDelivery} />
          )}

          {activeTab === 'delivery' && (
            <DeliveryTab
              digestMode={digestMode}
              onDigestModeChange={setDigestMode}
              quietHoursStart={quietHoursStart}
              onQuietHoursStartChange={setQuietHoursStart}
              quietHoursEnd={quietHoursEnd}
              onQuietHoursEndChange={setQuietHoursEnd}
              escalationEnabled={escalationEnabled}
              onEscalationEnabledChange={setEscalationEnabled}
              escalationAfterMinutes={escalationAfterMinutes}
              onEscalationAfterMinutesChange={setEscalationAfterMinutes}
              escalationRecipientRules={escalationRecipientRules}
              onEscalationRecipientRulesChange={setEscalationRecipientRules}
              readOnly={readOnly}
            />
          )}

          {activeTab === 'content' && (
            <ContentTab value={content} onChange={setContent} availableVariables={detail.availableVariables ?? ''} disabled={readOnly} />
          )}

          {activeTab === 'preview' && (
            <PreviewHistoryTab
              previewTitle={previewResult.title}
              previewSummary={previewResult.summary}
              history={history}
              isLoadingHistory={isLoadingHistory}
              canManage={isEdit}
              onRestore={handleRestore}
            />
          )}
        </div>
      </div>
    </div>
  );
};
