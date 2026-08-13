import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, FileText, Info, Shield, ShieldCheck, Tags, X, Sparkles } from 'lucide-react';
import { PageHeader } from '@/components/ui/page/PageHeader';
import { Button } from '@/components/ui/button/Button';
import { FormSection } from '@/components/ui/form/FormSection';
import { TabNav, type TabItem } from '@/components/ui/tabs/TabNav';
import { Select, type SelectOption } from '@/components/ui/select/Select';
import { Switch } from '@/components/ui/switch/Switch';
import { WarningBanner } from '@/components/ui/banner/WarningBanner';
import { useToast } from '@/components/ui/toast/Toast';
import { usePermissions } from '@/hooks/usePermissions';
import { notificationPolicyApi, type ComplianceGroup } from '@/services/api/notificationPolicy';
import { ROUTES } from '@/app/routes.constants';
import { notificationPolicy as notificationPolicyBreadcrumb } from '@/components/ui/breadcrumb/breadcrumbs/settings';
import { MODULE_PRESETS, buildEventCode, buildVariables, type EventPreset } from './eventPresets';
import { useTranslation } from '@/i18n';

const labelClass = 'text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block';
const inputClass =
  'w-full h-9 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors placeholder:text-slate-400';
const textareaClass =
  'w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors placeholder:text-slate-400 resize-none';

const MODULE_OPTIONS: SelectOption[] = [
  { label: 'Document Control', value: 'DOCUMENT_CONTROL' },
  { label: 'Controlled Copies', value: 'CONTROLLED_COPIES' },
  { label: 'Audit Trail', value: 'AUDIT_TRAIL' },
  { label: 'Security', value: 'SECURITY' },
  { label: 'System', value: 'SYSTEM' },
];

const PRIORITY_OPTIONS: SelectOption[] = [
  { label: 'Low', value: 'LOW' },
  { label: 'Medium', value: 'MEDIUM' },
  { label: 'High', value: 'HIGH' },
  { label: 'Critical', value: 'CRITICAL' },
];

const COMPLIANCE_OPTIONS: SelectOption[] = [
  { label: 'Optional', value: 'OPTIONAL' },
  { label: 'Compliance', value: 'COMPLIANCE' },
  { label: 'GMP Mandatory', value: 'GMP_MANDATORY' },
];

const CUSTOM_PRESET_VALUE = 'CUSTOM';
const VARIABLE_PATTERN = /^[a-zA-Z0-9_]+$/;

const CREATE_TABS: TabItem[] = [
  { id: 'general', label: 'General' },
  { id: 'recipients', label: 'Recipients' },
  { id: 'delivery', label: 'Delivery' },
  { id: 'content', label: 'Content' },
  { id: 'preview', label: 'Preview & History' },
];

export const NotificationPolicyCreateView: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { t } = useTranslation();
  const { hasPermissionAlias } = usePermissions();
  const canManage = hasPermissionAlias('settings.notification_policy.manage');

  const [showQuickFill, setShowQuickFill] = useState(false);
  const [activeTab, setActiveTab] = useState('general');
  const [module, setModule] = useState('DOCUMENT_CONTROL');
  const [presetSlug, setPresetSlug] = useState<string>(CUSTOM_PRESET_VALUE);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [complianceGroup, setComplianceGroup] = useState<ComplianceGroup>('OPTIONAL');
  const [relatedAction, setRelatedAction] = useState('');
  const [dataObject, setDataObject] = useState('');
  const [variables, setVariables] = useState<string[]>(['recipientName', 'actionUrl', 'systemName']);
  const [customVariableInput, setCustomVariableInput] = useState('');
  const [actionUrlTemplate, setActionUrlTemplate] = useState('');
  const [mandatory, setMandatory] = useState(false);
  const [mandatoryReason, setMandatoryReason] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const presetsForModule = MODULE_PRESETS[module] ?? [];
  const presetOptions: SelectOption[] = [
    { label: 'Choose a trigger…', value: CUSTOM_PRESET_VALUE },
    ...presetsForModule.map((p) => ({ label: p.actionLabel, value: p.actionSlug })),
  ];

  const applyPreset = (preset: EventPreset) => {
    setCode(buildEventCode(module, preset.actionSlug));
    setName(preset.nameTemplate);
    setRelatedAction(preset.actionSlug.toUpperCase());
    setDataObject(preset.dataObject);
    setVariables(buildVariables(preset));
    setActionUrlTemplate(preset.actionUrlTemplate);
  };

  const handlePresetChange = (value: string) => {
    setPresetSlug(value);
    if (value === CUSTOM_PRESET_VALUE) return;
    const preset = presetsForModule.find((p) => p.actionSlug === value);
    if (preset) applyPreset(preset);
  };

  const addVariable = () => {
    const value = customVariableInput.trim();
    if (!value) return;
    if (!VARIABLE_PATTERN.test(value)) {
      showToast({ type: 'error', title: t('notificationPolicy.invalidVariableTitle'), message: t('notificationPolicy.invalidVariableMessage') });
      return;
    }
    if (!variables.includes(value)) setVariables((prev) => [...prev, value]);
    setCustomVariableInput('');
  };

  const removeVariable = (value: string) => setVariables((prev) => prev.filter((v) => v !== value));

  const handleBack = () => navigate(ROUTES.SETTINGS.NOTIFICATION_POLICY);

  const handleSave = async () => {
    if (!code.trim() || !name.trim() || !module) {
      showToast({ type: 'error', title: t('notificationPolicy.validationTitle'), message: t('notificationPolicy.requiredFields') });
      return;
    }
    if (mandatory && !mandatoryReason.trim()) {
      showToast({ type: 'error', title: t('notificationPolicy.validationTitle'), message: t('notificationPolicy.mandatoryReasonRequired') });
      return;
    }
    setIsSaving(true);
    try {
      const created = await notificationPolicyApi.create({
        code: code.trim(),
        name: name.trim(),
        description: description.trim() || null,
        module,
        priority,
        complianceGroup,
        relatedAction: relatedAction.trim() || null,
        dataObject: dataObject.trim() || null,
        availableVariables: variables.join(',') || null,
        actionUrlTemplate: actionUrlTemplate.trim() || null,
        mandatory,
        mandatoryReason: mandatory ? mandatoryReason.trim() : null,
      });
      showToast({ type: 'success', title: t('notificationPolicy.createdTitle'), message: t('notificationPolicy.createdMessage') });
      navigate(`${ROUTES.SETTINGS.NOTIFICATION_POLICY}/${created.eventCode}/edit?tab=recipients`);
    } catch (error: any) {
      showToast({
        type: 'error',
        title: t('notificationPolicy.createFailedTitle'),
        message: error?.response?.data?.message || error?.response?.data?.error?.message || t('notificationPolicy.createFailedMessage'),
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!canManage) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-slate-500">
        <Shield className="h-12 w-12 text-slate-300" />
        <p className="text-lg font-semibold">Access Denied</p>
        <p className="text-sm">You do not have permission to create notification events.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <PageHeader
        title="New Notification Event"
        breadcrumbItems={notificationPolicyBreadcrumb(navigate)}
        actions={
          <>
            <Button variant="outline-emerald" size="sm" onClick={handleBack} className="whitespace-nowrap">
              Cancel
            </Button>
            <Button size="sm" variant="outline-emerald" onClick={() => void handleSave()} disabled={isSaving} className="whitespace-nowrap">
              {isSaving ? 'Saving…' : 'Save'}
            </Button>
          </>
        }
      />

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <TabNav tabs={CREATE_TABS} activeTab={activeTab} onChange={setActiveTab} />
        <div className="space-y-4 p-4 md:space-y-5 md:p-5">
      <FormSection title="Basic Information" icon={<ClipboardList className="h-4 w-4" />} className={activeTab === 'general' ? undefined : 'hidden'} contentClassName="p-4 md:p-5">
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className={labelClass}>
              Name <span className="text-red-500">*</span>
            </label>
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Document Approved" autoFocus />
            <p className="mt-1 text-2xs text-slate-400">Shown as the event's title everywhere in this screen.</p>
          </div>
          <div>
            <label className={labelClass}>Description</label>
            <textarea className={textareaClass} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="When does this event fire? (optional)" />
          </div>
        </div>
      </FormSection>

      <FormSection
        title="Event Metadata"
        icon={<Tags className="h-4 w-4" />}
        description="The same fields shown on an event's General tab after it's created."
        className={activeTab === 'general' ? undefined : 'hidden'}
        contentClassName="p-4 md:p-5"
      >
        {!showQuickFill ? (
          <button
            type="button"
            onClick={() => setShowQuickFill(true)}
            className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 hover:text-emerald-800"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Auto-fill from a common trigger (optional)
          </button>
        ) : (
          <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50/50 p-3">
            <Select label={`Trigger (for ${MODULE_OPTIONS.find((o) => o.value === module)?.label ?? module})`} value={presetSlug} onChange={(v) => handlePresetChange(String(v))} options={presetOptions} />
            <p className="mt-1.5 text-2xs text-slate-500">Change the Module field below first, then pick a trigger here to auto-fill the fields.</p>
          </div>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>
              Event Code <span className="text-red-500">*</span>
            </label>
            <input
              className={`${inputClass} font-mono`}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. document.custom_review"
            />
          </div>
          <Select label="Module" value={module} onChange={(v) => { setModule(String(v)); setPresetSlug(CUSTOM_PRESET_VALUE); }} options={MODULE_OPTIONS} />
          <Select label="Priority" value={priority} onChange={(v) => setPriority(String(v))} options={PRIORITY_OPTIONS} />
          <Select label="Compliance Group" value={complianceGroup} onChange={(v) => setComplianceGroup(v as ComplianceGroup)} options={COMPLIANCE_OPTIONS} />
          <div>
            <label className={labelClass}>Related Action</label>
            <input className={inputClass} value={relatedAction} onChange={(e) => setRelatedAction(e.target.value)} placeholder="e.g. APPROVE_COMPLETE (optional)" />
          </div>
          <div>
            <label className={labelClass}>Data Object</label>
            <input className={inputClass} value={dataObject} onChange={(e) => setDataObject(e.target.value)} placeholder="e.g. DOCUMENT_REVISION (optional)" />
          </div>
        </div>
      </FormSection>

      {activeTab === 'content' && <FormSection title="Variables & Action Link" description="Define variables and the action destination. Write the in-app title and summary after the event has been created." contentClassName="p-4 md:p-5">
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className={labelClass}>Action Link Template</label>
            <input
              className={`${inputClass} font-mono`}
              value={actionUrlTemplate}
              onChange={(e) => setActionUrlTemplate(e.target.value)}
              placeholder="/documents/{{documentNumber}} (optional)"
            />
          </div>
          <div>
            <label className={labelClass}>Available Variables</label>
            <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-slate-200 p-2">
              {variables.map((v) => (
                <span key={v} className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-2xs font-mono font-medium text-emerald-700">
                  {`{{${v}}}`}
                  <button type="button" onClick={() => removeVariable(v)} className="text-emerald-500 hover:text-emerald-800">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <input
                value={customVariableInput}
                onChange={(e) => setCustomVariableInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addVariable();
                  }
                }}
                onBlur={addVariable}
                placeholder="add variable name, press Enter"
                className="h-7 min-w-[160px] flex-1 border-0 text-xs outline-none placeholder:text-slate-400"
              />
            </div>
            <p className="mt-1 text-2xs text-slate-400">These are the only variables usable in this event's content — recipientName, actionUrl and systemName are always included.</p>
          </div>
        </div>
      </FormSection>}

      <FormSection title="GMP Compliance" icon={<ShieldCheck className="h-4 w-4" />} className={activeTab === 'general' ? undefined : 'hidden'} contentClassName="p-4 md:p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-900">Mandatory (GMP-locked)</p>
            <p className="text-xs text-slate-500">Mandatory events cannot be disabled or deleted, and their recipients/channels are locked.</p>
          </div>
          <Switch checked={mandatory} onChange={setMandatory} />
        </div>
        {mandatory && (
          <div className="mt-4">
            <label className={labelClass}>
              Mandatory Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              className={textareaClass}
              rows={2}
              value={mandatoryReason}
              onChange={(e) => setMandatoryReason(e.target.value)}
              placeholder="Why is this event GMP-mandatory?"
            />
          </div>
        )}
      </FormSection>
      {(activeTab === 'recipients' || activeTab === 'delivery' || activeTab === 'preview') && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center">
          <Info className="mx-auto h-6 w-6 text-slate-400" />
          <p className="mt-3 text-sm font-semibold text-slate-800">Available after creating this event</p>
          <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-slate-500">
            Save the event first. You can then configure recipients, delivery rules, preview content and version history in this same tabbed workspace.
          </p>
        </div>
      )}
        </div>
      </div>
    </div>
  );
};
