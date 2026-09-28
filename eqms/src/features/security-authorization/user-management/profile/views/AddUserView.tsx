import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from"react-router-dom";
import { Button } from"@/components/ui/button/Button";
import { AlertModal } from"@/components/ui/modal/AlertModal";
import { NavigationGuardModal } from"@/components/ui/modal/NavigationGuardModal";
import { CredentialsModal } from"../components/CredentialsModal";
import { useToast } from"@/components/ui/toast";
import { NewUser } from"../../types";
import { USER_MANAGEMENT_ROUTES } from"../../constants";
import { generateUsername } from"../utils";
import { PageHeader } from"@/components/ui/page/PageHeader";
import { TabNav } from "@/components/ui/tabs/TabNav";
import type { TabItem } from "@/components/ui/tabs/TabNav";
import { addUser as addUserBreadcrumb } from"@/components/ui/breadcrumb/breadcrumbs.config";
import { FullPageLoading } from"@/components/ui/loading/Loading";
import { settingsApi, type AccessProfileResponse } from "@/services/api/settings";
import { dictionaryApi } from "@/services/api";
import type { User, EducationItem, Certification } from "../../types";
import { isFutureDateValue, isValidEmail, isValidPhone, normalizeDigitsOnly } from "../validation";
import { useSecurityESign } from "@/features/security-authorization/shared/useSecurityESign";
import { useSodAccessProfileCheck } from "@/features/security-authorization/shared/useSodAccessProfileCheck";
import { usePermissions } from "@/hooks/usePermissions";
import { PersonalTab } from "../tabs/PersonalTab";
import { EmploymentTab } from "../tabs/EmploymentTab";
import { QualificationsTab } from "../tabs/QualificationsTab";
import { AccountStatusTab } from "../tabs/AccountStatusTab";
import { SecurityAuthorizationTab } from "../tabs/SecurityAuthorizationTab";

type LookupOption = { label: string; value: string };
type DictionaryBusinessUnit = { name: string; isActive?: boolean };
type DictionaryDepartment = { name: string; businessUnit: string; isActive?: boolean; departmentHeadName?: string | null };
type DictionaryPosition = { name: string; businessUnit: string; department: string; isActive?: boolean };

const toLookupOptions = (items?: Array<{ label?: string | null; value?: string | null }>) =>
 Array.isArray(items)
  ? items
    .filter((item): item is { label: string; value: string } => Boolean(item?.label && item?.value))
    .map((item) => ({ label: item.label, value: item.value }))
  : [];

const normalizeApiMessage = (error: unknown): { title: string; message: string } => {
 if (typeof error !== "object" || error === null) {
  return { title: "Create Failed", message: "Unable to create user." };
 }

 const candidate = error as {
  response?: {
   data?: {
    error?: { message?: string };
    message?: string;
   };
  };
  message?: string;
 };

 const message =
  candidate.response?.data?.error?.message ||
  candidate.response?.data?.message ||
  candidate.message ||
  "Unable to create user.";

 if (/employee id already exists/i.test(message)) {
  return { title: "Employee ID Exists", message };
 }
 if (/username already exists/i.test(message)) {
  return { title: "Username Exists", message };
 }
 if (/email already exists/i.test(message)) {
  return { title: "Email Exists", message };
 }

 return { title: "Create Failed", message };
};

const dedupeLookupOptions = (options: LookupOption[]) => {
 const seen = new Set<string>();
 return options.filter((option) => {
  const key = option.value.trim().toLowerCase();
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
 });
};

export const AddUserView: React.FC = () => {
 const navigate = useNavigate();
 const { showToast } = useToast();
 const { requestSignature, signatureModal } = useSecurityESign();
 const { hasPermission } = usePermissions();
 const canInviteExternal = hasPermission("users.invite_external");

 const [isLoading, setIsLoading] = useState(true);
 const [isSubmitting, setIsSubmitting] = useState(false);

  const [newUser, setNewUser] = useState<NewUser>({
    employeeCode: "",
    username: "",
    fullName: "",
    email: "",
    phone: "",
    accessProfileIds: [],
    businessUnit: "",
    department: "",
    status: "" as any,
    position: "",
    permissions: [],
    inviteExternal: false,
    homePage: "DASHBOARD",
    mfaRequiredByAdmin: false,
  });
 const [isUsernameEdited, setIsUsernameEdited] = useState(false);
 type CreateTab = "personal" | "employment" | "qualifications" | "account" | "security";
 const [activeTab, setActiveTab] = useState<CreateTab>("personal");

 // Education & Certifications -- same multi-entry table + Add/Edit/Delete UI as the Detail/Edit
 // screen's Training & Competency tab (QualificationsTab, reused directly below). The user
 // doesn't exist yet, so entries are held as a local draft list here and only persisted (via the
 // same settingsApi endpoints useUserProfile#saveEdu/saveCert use) right after the account
 // itself is created -- see handleSubmit. QualificationsTab owns its own Add/Edit/Delete modal
 // state internally; this view only needs to hold the resulting list + apply the edits.
 const [draftEducationList, setDraftEducationList] = useState<EducationItem[]>([]);
 const [draftCertifications, setDraftCertifications] = useState<Array<Certification & { _file?: File | null }>>([]);

 const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});
 const [showCancelModal, setShowCancelModal] = useState(false);
 const [showCredentialsModal, setShowCredentialsModal] = useState(false);
 const [generatedCredentials, setGeneratedCredentials] = useState({ id: "", username:"", password:"" });
 const [isRegeneratingPassword, setIsRegeneratingPassword] = useState(false);
 const [isNavigating, setIsNavigating] = useState(false);
 const [apiErrorModal, setApiErrorModal] = useState<{ isOpen: boolean; title: string; message: string }>({
  isOpen: false,
  title: "",
  message: "",
 });
 const [existingUsers, setExistingUsers] = useState<User[]>([]);
 const [lookupAccessProfiles, setLookupAccessProfiles] = useState<LookupOption[]>([]);
 const [accessProfiles, setAccessProfiles] = useState<AccessProfileResponse[]>([]);
 const [lookupGenders, setLookupGenders] = useState<LookupOption[]>([]);
 const [lookupEmploymentTypes, setLookupEmploymentTypes] = useState<LookupOption[]>([]);
 const [lookupStatuses, setLookupStatuses] = useState<LookupOption[]>([]);
 const [lookupBusinessUnits, setLookupBusinessUnits] = useState<LookupOption[]>([]);
 const [lookupDepartments, setLookupDepartments] = useState<LookupOption[]>([]);
 const [lookupPositions, setLookupPositions] = useState<LookupOption[]>([]);
 const [lookupLanguages, setLookupLanguages] = useState<LookupOption[]>([]);
 // Direct Manager's default option list -- fetched via the dedicated lightweight
 // /settings/users/manager-options endpoint (same one the Edit flow already uses), not derived
 // from the full existingUsers list, so it's ready well before that much heavier 1000-row fetch
 // finishes (that heavier fetch enriches every row with sessions/access-profiles/Entra status,
 // none of which this dropdown needs).
 const [managerLookupOptions, setManagerLookupOptions] = useState<LookupOption[]>([]);
 const [businessUnits, setBusinessUnits] = useState<DictionaryBusinessUnit[]>([]);
 const [departments, setDepartments] = useState<DictionaryDepartment[]>([]);
 const [positions, setPositions] = useState<DictionaryPosition[]>([]);


 const formDepartments = useMemo(() => {
  if (!newUser.businessUnit) return [];

  const dictionaryDepartmentsForUnit = departments
    .filter((dept) => dept.businessUnit === newUser.businessUnit && dept.isActive !== false)
    .map((dept) => dept.name);

  if (dictionaryDepartmentsForUnit.length > 0) return dictionaryDepartmentsForUnit;

  return lookupDepartments.map((dept) => dept.value);
 }, [newUser.businessUnit, departments, lookupDepartments]);

 const managerOptions = managerLookupOptions;

 const searchManagerOptions = useCallback(async (query: string) => {
  const usersPage = await settingsApi.getUsers({ page: 1, limit: 20, search: query });
  return usersPage.data
   .filter((u) => u.fullName && u.id)
   .map((u) => ({ label: u.employeeCode ? `${u.employeeCode} - ${u.fullName}` : u.fullName, value: u.fullName }));
 }, []);

 const positionOptions = useMemo(() => {
   const base = [{ label: "Select Position", value: "" }];
   if (!newUser.businessUnit || !newUser.department) return base;

   const filtered = positions
    .filter(
     (position) =>
      position.isActive !== false &&
      position.businessUnit === newUser.businessUnit &&
      position.department === newUser.department
    )
    .map((position) => ({ label: position.name, value: position.name }));

   return filtered.length > 0 ? [...base, ...filtered] : base;
  }, [positions, newUser.businessUnit, newUser.department]);

 useEffect(() => {
  const loadLookupOptions = async () => {
   try {
    const [filtersResult, accessProfilesResult, businessUnitsResult, departmentsResult, positionsResult, languagesResult, managerOptionsResult] = await Promise.allSettled([
     settingsApi.getUserFilters(),
     settingsApi.listAllAccessProfiles(),
     dictionaryApi.getBusinessUnits(),
     dictionaryApi.getDepartments(),
     dictionaryApi.getPositions(),
     dictionaryApi.getLanguages(),
     settingsApi.getUserManagerOptions(),
    ]);

    if (filtersResult.status === "fulfilled") {
     const filters = filtersResult.value;
     const roles = toLookupOptions(filters.roles);
     const genders = toLookupOptions(filters.genders);
     const employmentTypes = toLookupOptions(filters.employmentTypes);
     const statuses = toLookupOptions(filters.statuses);
     const businessUnitsLookup = toLookupOptions(filters.businessUnits);
     const departmentsLookup = toLookupOptions(filters.departments);
     const positionsLookup = toLookupOptions(filters.positions);

     setLookupAccessProfiles(roles);
     setLookupGenders(genders);
     setLookupEmploymentTypes(employmentTypes);
     setLookupStatuses(statuses);
     setLookupBusinessUnits(businessUnitsLookup);
     setLookupDepartments(departmentsLookup);
     setLookupPositions(positionsLookup);
    } else {
     showToast({
      type: "error",
      title: "Unable to Load User Options",
      message: "User lookup options could not be loaded. Please refresh before creating a user.",
     });
    }

    if (accessProfilesResult.status === "fulfilled") {
     const active = accessProfilesResult.value.filter((profile) => profile.active);
     const activeProfiles = active.map((profile) => ({ label: `${profile.name} (${profile.code})`, value: profile.id }));
     setLookupAccessProfiles(activeProfiles);
     setAccessProfiles(active);
    } else {
     showToast({
      type: "error",
      title: "Unable to Load Access Profiles",
      message: "Access Profiles could not be loaded. Please refresh before creating a user.",
     });
    }

    if (businessUnitsResult.status === "fulfilled") {
     const businessUnitOptions = toLookupOptions(businessUnitsResult.value.map((item) => ({ label: item.name, value: item.name })));
     if (businessUnitOptions.length > 0) {
      setLookupBusinessUnits((prev) => dedupeLookupOptions([...prev, ...businessUnitOptions]));
     }
     setBusinessUnits(
      businessUnitsResult.value
       .filter((item) => item.isActive !== false)
       .map((item) => ({ name: item.name, isActive: item.isActive }))
     );
    } else if (import.meta.env.DEV) {
     console.error("Failed to load business units", businessUnitsResult.reason);
    }

    if (departmentsResult.status === "fulfilled") {
     const departmentOptions = toLookupOptions(departmentsResult.value.map((item) => ({ label: item.name, value: item.name })));
     if (departmentOptions.length > 0) {
      setLookupDepartments((prev) => dedupeLookupOptions([...prev, ...departmentOptions]));
     }
     setDepartments(
      departmentsResult.value
       .filter((item) => item.isActive !== false)
       .map((item) => ({ name: item.name, businessUnit: item.businessUnit, isActive: item.isActive, departmentHeadName: item.departmentHeadName }))
     );
    } else if (import.meta.env.DEV) {
     console.error("Failed to load departments", departmentsResult.reason);
    }

    if (positionsResult.status === "fulfilled") {
     const positionOptions = toLookupOptions(positionsResult.value.map((item) => ({ label: item.name, value: item.name })));
     if (positionOptions.length > 0) {
      setLookupPositions((prev) => dedupeLookupOptions([...prev, ...positionOptions]));
     }
     setPositions(
      positionsResult.value
       .filter((item) => item.isActive !== false)
       .map((item) => ({
        name: item.name,
        businessUnit: item.businessUnit,
        department: item.department,
        isActive: item.isActive,
       }))
     );
    } else if (import.meta.env.DEV) {
     console.error("Failed to load positions", positionsResult.reason);
    }

    if (languagesResult.status === "fulfilled") {
      setLookupLanguages(dedupeLookupOptions(languagesResult.value));
    } else if (import.meta.env.DEV) {
     console.error("Failed to load languages", languagesResult.reason);
    }

    if (managerOptionsResult.status === "fulfilled") {
     setManagerLookupOptions(managerOptionsResult.value.map((m) => ({ label: m.label, value: m.value })));
    } else if (import.meta.env.DEV) {
     console.error("Failed to load manager options", managerOptionsResult.reason);
    }

    if (businessUnitsResult.status !== "fulfilled") {
     setBusinessUnits([]);
    }
    if (departmentsResult.status !== "fulfilled") {
     setDepartments([]);
    }
    if (positionsResult.status !== "fulfilled") {
     setPositions([]);
    }
    if (languagesResult.status !== "fulfilled") {
     setLookupLanguages([]);
    }
   } finally {
    setIsLoading(false);
   }
  };

  const loadExistingUsers = async () => {
   try {
    const usersPage = await settingsApi.getUsers({ page: 1, limit: 1000 });
    setExistingUsers(usersPage.data ?? []);
   } catch (error) {
    setExistingUsers([]);
    if (import.meta.env.DEV) console.error("Failed to load existing users", error);
   }
  };

  // Dedicated lightweight endpoint -- avoids waiting on the heavy 1000-row getUsers() fetch
  // above (username/email de-dup still needs that full list, but the Employee ID suggestion
  // doesn't) so the field fills in immediately instead of lagging behind admin-list enrichment.
  const loadNextEmployeeCode = async () => {
   try {
    const nextCode = await settingsApi.getNextEmployeeCode();
    setNewUser((prev) => (prev.employeeCode.trim() ? prev : { ...prev, employeeCode: nextCode }));
   } catch (error) {
    if (import.meta.env.DEV) console.error("Failed to load next employee code", error);
   }
  };

  setIsLoading(true);
  void loadLookupOptions();
  void loadExistingUsers();
  void loadNextEmployeeCode();
 }, []);

 const existingUsernames = useMemo(
  () => existingUsers.map((user) => user.username.toLowerCase()),
  [existingUsers]
 );

 const validateForm = (): boolean => {
 const errors: { [key: string]: string } = {};

 if (!newUser.employeeCode) {
 errors.employeeCode = "Employee ID is required";
 } else if (!/^NTP\.\d{4}$/.test(newUser.employeeCode)) {
 errors.employeeCode = "Employee ID must be 4 digits";
 }

 if (!newUser.fullName.trim()) {
 errors.fullName = "Full Name is required";
 }

 if (!newUser.username.trim()) {
 errors.username = "Username is required";
 }

 if (!newUser.email.trim()) {
  errors.email = "Email is required";
 } else if (!isValidEmail(newUser.email)) {
  errors.email = "Invalid email format";
 }

 if (newUser.phone && !isValidPhone(newUser.phone)) {
  errors.phone = "Phone number must contain 7-15 digits only";
 }

 if (newUser.dateOfBirth && isFutureDateValue(newUser.dateOfBirth)) {
  errors.dateOfBirth = "Date of Birth cannot be in the future";
 }

 if (newUser.startDate && isFutureDateValue(newUser.startDate)) {
  errors.startDate = "Start Date cannot be in the future";
 }

 if (!newUser.position?.trim()) {
 errors.position = "Position is required";
 }

 if (!newUser.startDate) {
 errors.startDate = "Start Date is required";
 }

 if (!newUser.employmentType) {
 errors.employmentType = "Employment Type is required";
 }

 if (!newUser.businessUnit) {
 errors.businessUnit = "Business Unit is required";
 }

 if (!newUser.department) {
 errors.department = "Department is required";
 }

 if (!newUser.accessProfileIds || newUser.accessProfileIds.length === 0) {
 errors.accessProfileIds = "Select at least one Access Profile";
 }

 if (!newUser.status) {
 errors.status = "Account Status is required";
 }

 setFormErrors(errors);
 return Object.keys(errors).length === 0;
 };

 const handleRegeneratePassword = async () => {
 if (!generatedCredentials.id || isRegeneratingPassword) {
 return;
 }
 const signature = await requestSignature("Reset temporary password", "User Access Change");
 if (!signature) return;
 setIsRegeneratingPassword(true);
 try {
 const result = await settingsApi.resetPassword(generatedCredentials.id, {
  signatureToken: signature.signatureToken,
  reason: signature.reason,
  sendEmail: false,
 });
 setGeneratedCredentials((prev) => ({ ...prev, password: result.password }));
 } catch (error: any) {
 showToast({
 type: "error",
 title: "Error",
 message: error?.response?.data?.message || "Failed to regenerate password",
 });
 } finally {
 setIsRegeneratingPassword(false);
 }
 };

 const handleSubmit = async () => {
 if (!validateForm()) {
 showToast({ type: "error", title: "Error", message: "Please fix all errors before submitting" });
 return;
 }
 if (hasBlockingSodViolation) {
 showToast({ type: "error", title: "Segregation of Duties Conflict", message: "Resolve the blocked Access Profile conflict before creating this user." });
 return;
 }

 try {
  setIsSubmitting(true);
  const activeProfileIds = new Set(lookupAccessProfiles.map((profile) => profile.value));
  if (!(newUser.accessProfileIds ?? []).every((id) => activeProfileIds.has(id))) {
   setFormErrors((prev) => ({ ...prev, accessProfileIds: "One or more selected Access Profiles is no longer active" }));
   return;
  }
  const payload = { ...newUser };

  const created = await settingsApi.createUser(payload);

  // Persist the draft Education/Certification entries now that the account exists --
  // same endpoints useUserProfile#saveEdu/saveCert use for an existing user. Failures here
  // are non-fatal to account creation itself (the account was already created successfully);
  // surface them as a separate warning instead of blocking the Credentials Modal.
  let qualificationSaveFailures = 0;
  for (const edu of draftEducationList) {
   try {
    await settingsApi.addUserEducation(created.user.id, {
     degree: edu.degree,
     fieldOfStudy: edu.fieldOfStudy,
     institution: edu.institution,
     graduationYear: edu.graduationYear,
     gpa: edu.gpa,
    });
   } catch {
    qualificationSaveFailures += 1;
   }
  }
  for (const cert of draftCertifications) {
   try {
    const createdCert = await settingsApi.addUserCertification(created.user.id, {
     name: cert.name,
     issuingOrg: cert.issuingOrg,
     issueDate: cert.issueDate,
     expiryDate: cert.expiryDate,
    });
    if (cert._file) {
     await settingsApi.uploadUserCertificationFile(created.user.id, (createdCert as Certification).id, cert._file);
    }
   } catch {
    qualificationSaveFailures += 1;
   }
  }

  setGeneratedCredentials({
   id: created.user.id,
   username: created.user.username,
   password: created.password,
  });
  setShowCredentialsModal(true);
  setExistingUsers((prev) => [created.user, ...prev]);
  showToast({
   type: "success",
   title: "Success",
   message: `User ${created.user.fullName} created successfully`,
  });
  if (qualificationSaveFailures > 0) {
   showToast({
    type: "error",
    title: "Some Qualification Records Failed",
    message: `${qualificationSaveFailures} education/certification entr${qualificationSaveFailures === 1 ? "y" : "ies"} could not be saved. Add ${qualificationSaveFailures === 1 ? "it" : "them"} from the user's profile.`,
   });
  }
 } catch (error: any) {
   if (error.response?.data?.body) {
    const body = error.response.data.body;
    if (body.code === "VALIDATION_ERROR" && body.details) {
     const newErrors: { [key: string]: string } = {};
     body.details.forEach((detail: any) => {
      newErrors[detail.field] = detail.message;
     });
     setFormErrors((prev) => ({ ...prev, ...newErrors }));
     showToast({ type: "error", title: "Validation Failed", message: "Please fix the highlighted fields" });
     return;
    } else if (body.code === "BAD_REQUEST") {
     const msg = body.message || "Bad Request";
     if (/employee id already exists/i.test(msg)) {
      setFormErrors((prev) => ({ ...prev, employeeCode: msg }));
     } else if (/username already exists/i.test(msg)) {
      setFormErrors((prev) => ({ ...prev, username: msg }));
     } else if (/email already exists/i.test(msg)) {
      setFormErrors((prev) => ({ ...prev, email: msg }));
     } else {
      setApiErrorModal({ isOpen: true, title: "Create Failed", message: msg });
     }
     showToast({ type: "error", title: "Validation Failed", message: "Please fix the highlighted fields" });
     return;
    }
   }
   const { title, message } = normalizeApiMessage(error);
   setApiErrorModal({ isOpen: true, title, message });
  } finally {
   setIsSubmitting(false);
  }
  };

 const handleCancel = () => {
 setShowCancelModal(true);
 };

 const handleConfirmCancel = () => {
 setShowCancelModal(false);
 setIsNavigating(true);
 setTimeout(() => navigate(USER_MANAGEMENT_ROUTES.LIST), 600);
 };

 const handleCredentialsClose = () => {
 setShowCredentialsModal(false);
 setIsNavigating(true);
 setTimeout(() => navigate(USER_MANAGEMENT_ROUTES.LIST), 600);
 };

 const employeeCodeDisplay = newUser.employeeCode || "NTP.";

 // No Primary/Additional split -- user_access_profiles has no such distinction persisted at all,
 // it was a FE-only concept that (per audit) never even reached the backend. One flat multi-select
 // list matches what's actually stored and actually enforced (permissions are unioned across every
 // Access Profile a user holds, regardless of any ordering).
 const selectedAccessProfileIds = newUser.accessProfileIds ?? [];
 const { checking: checkingSod, hasBlockingViolation: hasBlockingSodViolation } =
  useSodAccessProfileCheck(selectedAccessProfileIds, true);

 const generateDraftId = () => `draft-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

 // Matches QualificationsTab's onEduSave/onEduDelete/onCertSave/onCertDelete contract exactly
 // (see tabs/QualificationsTab.tsx) -- that component owns its own Add/Edit/Delete-confirm modal
 // state internally, this view only applies the resulting change to the local draft list.
 const handleEduSave = (data: Omit<EducationItem, "id">, editing: EducationItem | null) => {
  if (editing) {
   setDraftEducationList((prev) => prev.map((e) => (e.id === editing.id ? { ...data, id: editing.id } : e)));
  } else {
   setDraftEducationList((prev) => [...prev, { ...data, id: generateDraftId() }]);
  }
 };
 const handleEduDelete = (id: string) => setDraftEducationList((prev) => prev.filter((e) => e.id !== id));

 const handleCertSave = (data: Omit<Certification, "id">, editing: Certification | null, file: File | null) => {
  if (editing) {
   setDraftCertifications((prev) => prev.map((c) => (c.id === editing.id
    ? {
      ...c,
      ...data,
      fileName: file ? file.name : c.fileName,
      fileType: file ? file.type : c.fileType,
      fileSize: file ? file.size : c.fileSize,
      fileObjectUrl: file ? URL.createObjectURL(file) : c.fileObjectUrl,
      _file: file ?? c._file,
    }
    : c)));
  } else {
   setDraftCertifications((prev) => [...prev, {
    ...data,
    id: generateDraftId(),
    fileName: file?.name,
    fileType: file?.type,
    fileSize: file?.size,
    fileObjectUrl: file ? URL.createObjectURL(file) : undefined,
    _file: file,
   }]);
  }
 };
 const handleCertDelete = (id: string) => setDraftCertifications((prev) => prev.filter((c) => c.id !== id));

 const businessUnitOptions = dedupeLookupOptions([
  ...lookupBusinessUnits,
  ...businessUnits.map((unit) => ({ label: unit.name, value: unit.name })),
 ]);
 const departmentOptions = dedupeLookupOptions([
  ...lookupDepartments,
  ...formDepartments.map((dept) => ({ label: dept, value: dept })),
 ]);
 const positionOptionsWithFallback = dedupeLookupOptions([
  ...lookupPositions,
  ...positionOptions.slice(1),
 ]);

 // Adapter for the shared PersonalTab/EmploymentTab/QualificationsTab components (built for an
 // existing User + separate draft), reused here for creation -- the "user" and "draft" are the
 // same in-progress record, always editable, so isEditing is always true and there's no read-only
 // display state to worry about. Preserves the field-specific side effects the old inline inputs
 // had (username auto-fill from full name, resetting dependent business unit/department/position
 // selects) since the shared tabs only expose a single onDraftChange(key, value) callback.
 const draftAsUser: User = {
  ...(newUser as unknown as User),
  id: "",
  role: "",
  accessProfileNames: [],
  lastLogin: "Never",
  createdDate: "",
  lastUpdated: "",
 };
 const updateDraftField = (key: keyof User, value: string) => {
  if (key === "username") setIsUsernameEdited(true);
  setFormErrors((prev) => {
   const next = { ...prev, [key]: "" };
   if (key === "businessUnit") { next.department = ""; next.position = ""; }
   if (key === "department") { next.position = ""; }
   return next;
  });
  setNewUser((prev) => {
   const next: any = { ...prev, [key]: value };
   if (key === "fullName" && !isUsernameEdited) {
    next.username = generateUsername(value, existingUsernames);
   }
   if (key === "businessUnit") { next.department = ""; next.position = ""; }
   if (key === "department") {
    next.position = "";
    // Auto-select Direct Manager as the chosen department's head, since that's who a new
    // employee in that department normally reports to -- Direct Manager stays a plain optional
    // field, so the admin can still edit or clear it afterward. Match on name only (not also
    // businessUnit): the Department dropdown's options can fall back to a looser source
    // (getUserFilters' aggregated department list) when the dictionary has no active
    // departments for the selected Business Unit yet, and that fallback list's businessUnit
    // pairing won't line up with the dictionary's -- name alone is what's actually unique here.
    const dept = departments.find((d) => d.name === value);
    next.managerName = dept?.departmentHeadName || "";
   }
   return next;
  });
 };

 return (
 <div className="space-y-6 w-full flex-1 flex flex-col">
  {/* Header */}
  <PageHeader
   title="Add New User"
   breadcrumbItems={addUserBreadcrumb(navigate)}
   actions={
    <>
     <Button onClick={handleCancel} variant="outline-emerald" size="sm" className="whitespace-nowrap gap-2">Cancel</Button>
     <Button onClick={handleSubmit} variant="outline-emerald" size="sm" className="whitespace-nowrap gap-2" disabled={isSubmitting || isLoading || hasBlockingSodViolation || checkingSod}>
      Create User
     </Button>
    </>
   }
  />

  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
   <TabNav
    tabs={[
     { id: "personal", label: "Personal & Identity" },
     { id: "employment", label: "Employment Record" },
     { id: "qualifications", label: "Training & Competency" },
     { id: "account", label: "Account Status" },
     { id: "security", label: "Security & Compliance" },
    ] as TabItem[]}
    activeTab={activeTab}
    onChange={(id) => setActiveTab(id as CreateTab)}
   />
   <div className="p-4 md:p-5">
   {activeTab === "personal" && (
  <div>
   <PersonalTab
    user={draftAsUser}
    draft={draftAsUser}
    isEditing
    languageOptions={lookupLanguages}
    onDraftChange={updateDraftField}
    fieldErrors={formErrors}
   />
  </div>
   )}
   {activeTab === "employment" && (
   <EmploymentTab
    user={draftAsUser}
    draft={draftAsUser}
    isEditing
    draftDepartments={formDepartments}
    businessUnitOptions={businessUnitOptions}
    managerOptions={managerOptions}
    positionOptions={positionOptionsWithFallback}
    yearsOfService={null}
    onDraftChange={updateDraftField}
    fieldErrors={formErrors}
   />
   )}
   {activeTab === "qualifications" && (
   <QualificationsTab
    user={draftAsUser}
    draft={draftAsUser}
    isEditing
    fieldErrors={formErrors}
    certifications={draftCertifications}
    educationList={draftEducationList}
    canEdit
    onDraftChange={updateDraftField}
    onCertSave={handleCertSave}
    onCertDelete={handleCertDelete}
    onEduSave={handleEduSave}
    onEduDelete={handleEduDelete}
   />
   )}
   {activeTab === "account" && (
   <AccountStatusTab
    mode="create"
    status={newUser.status}
    statusOptions={[{ label: "Select Account Status", value: "" }, ...lookupStatuses]}
    onStatusChange={(value) => { setNewUser({ ...newUser, status: value as any }); setFormErrors({ ...formErrors, status: "" }); }}
    statusError={formErrors.status}
    homePage={newUser.homePage || "DASHBOARD"}
    onHomePageChange={(value) => setNewUser({ ...newUser, homePage: value as any })}
    canInviteExternal={canInviteExternal}
    inviteExternal={Boolean(newUser.inviteExternal)}
    onInviteExternalChange={(checked) => setNewUser({ ...newUser, inviteExternal: checked })}
   />
   )}
   {activeTab === "security" && (
   <SecurityAuthorizationTab
    mode="create"
    mfaRequiredByAdmin={Boolean(newUser.mfaRequiredByAdmin)}
    onMfaRequiredByAdminChange={(value) => setNewUser({ ...newUser, mfaRequiredByAdmin: value })}
    allProfiles={accessProfiles}
    selectedProfileIds={selectedAccessProfileIds}
    onSelectionChange={(ids) => setNewUser({ ...newUser, accessProfileIds: ids })}
    selectionError={formErrors.accessProfileIds}
   />
   )}
   </div>
  </div>

  {/* Modals */}
 <NavigationGuardModal
 isOpen={showCancelModal}
 onClose={() => setShowCancelModal(false)}
 onConfirm={handleConfirmCancel}
 mode="discard"
 currentPageTitle="Add User"
 title="Cancel User Creation?"
 primaryActionLabel="Cancel"
 secondaryActionLabel="Continue editing"
 description="Are you sure you want to cancel? All entered information will be lost."
 />

 <CredentialsModal
 isOpen={showCredentialsModal}
 onClose={handleCredentialsClose}
 employeeCode={employeeCodeDisplay}
 username={generatedCredentials.username}
 password={generatedCredentials.password}
 onRegeneratePassword={handleRegeneratePassword}
 isRegeneratingPassword={isRegeneratingPassword}
 />

 <AlertModal
  isOpen={apiErrorModal.isOpen}
  onClose={() => setApiErrorModal({ isOpen: false, title: "", message: "" })}
  type="error"
  title={apiErrorModal.title}
  description={apiErrorModal.message}
  confirmText="Close"
  showCancel={false}
 />

 {signatureModal}

 {isNavigating && <FullPageLoading text="Loading..." />}
 </div>
 );
};
