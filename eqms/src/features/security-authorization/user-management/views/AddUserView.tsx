import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from"react-router-dom";
import { AlertTriangle, User as UserIcon, Briefcase, Shield, GraduationCap, Info, Search, Star } from"lucide-react";
import { Button } from"@/components/ui/button/Button";
import { Select } from"@/components/ui/select/Select";
import { Checkbox } from "@/components/ui/checkbox/Checkbox";
import { Badge } from "@/components/ui/badge/Badge";
import { DateTimePicker } from"@/components/ui/datetime-picker/DateTimePicker";
import { AlertModal } from"@/components/ui/modal/AlertModal";
import { NavigationGuardModal } from"@/components/ui/modal/NavigationGuardModal";
import { CredentialsModal } from"../components/CredentialsModal";
import { useToast } from"@/components/ui/toast";
import { cn } from"@/components/ui/utils";
import { NewUser } from"../types";
import { USER_MANAGEMENT_ROUTES } from"../constants";
import { generateUsername } from"../utils";
import { PageHeader } from"@/components/ui/page/PageHeader";
import { FormSection } from "@/components/ui/form";
import { addUser as addUserBreadcrumb } from"@/components/ui/breadcrumb/breadcrumbs.config";
import { FullPageLoading } from"@/components/ui/loading/Loading";
import { settingsApi, type AccessProfileResponse } from "@/services/api/settings";
import { dictionaryApi } from "@/services/api";
import type { User } from "../types";
import { isFutureDateValue, isValidEmail, isValidPhone, normalizeDigitsOnly } from "../validation";
import { useSecurityESign } from "@/features/security-authorization/shared/useSecurityESign";
import { useSodAccessProfileCheck } from "@/features/security-authorization/shared/useSodAccessProfileCheck";
import { SodViolationPanel } from "@/features/security-authorization/shared/SodViolationPanel";
import { usePermissions } from "@/hooks/usePermissions";

type LookupOption = { label: string; value: string };
type DictionaryBusinessUnit = { name: string; isActive?: boolean };
type DictionaryDepartment = { name: string; businessUnit: string; isActive?: boolean };
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

const suggestNextEmployeeDigits = (users: User[]): string => {
 const max = users.reduce((currentMax, user) => {
  const match = String(user.employeeCode || "").match(/(\d+)\s*$/);
  const parsed = match ? Number.parseInt(match[1], 10) : 0;
  return Number.isFinite(parsed) ? Math.max(currentMax, parsed) : currentMax;
 }, 0);

 return String(max + 1).padStart(4, "0");
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
    primaryAccessProfileId: "",
    additionalAccessProfileIds: [],
    businessUnit: "",
    department: "",
    status: "" as any,
    position: "",
    permissions: [],
    inviteExternal: false,
  });
 const [isUsernameEdited, setIsUsernameEdited] = useState(false);

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
 const [lookupRoles, setLookupRoles] = useState<LookupOption[]>([]);
 const [accessProfiles, setAccessProfiles] = useState<AccessProfileResponse[]>([]);
 const [accessProfileSearch, setAccessProfileSearch] = useState("");
 const [lookupGenders, setLookupGenders] = useState<LookupOption[]>([]);
 const [lookupEmploymentTypes, setLookupEmploymentTypes] = useState<LookupOption[]>([]);
 const [lookupStatuses, setLookupStatuses] = useState<LookupOption[]>([]);
 const [lookupBusinessUnits, setLookupBusinessUnits] = useState<LookupOption[]>([]);
 const [lookupDepartments, setLookupDepartments] = useState<LookupOption[]>([]);
 const [lookupPositions, setLookupPositions] = useState<LookupOption[]>([]);
 const [lookupLanguages, setLookupLanguages] = useState<LookupOption[]>([]);
 const [businessUnits, setBusinessUnits] = useState<DictionaryBusinessUnit[]>([]);
 const [departments, setDepartments] = useState<DictionaryDepartment[]>([]);
 const [positions, setPositions] = useState<DictionaryPosition[]>([]);

 const [warnings, setWarnings] = useState<{ [key: string]: string }>({});

 const formDepartments = useMemo(() => {
  if (!newUser.businessUnit) return [];

  const dictionaryDepartmentsForUnit = departments
    .filter((dept) => dept.businessUnit === newUser.businessUnit && dept.isActive !== false)
    .map((dept) => dept.name);

  if (dictionaryDepartmentsForUnit.length > 0) return dictionaryDepartmentsForUnit;

  return lookupDepartments.map((dept) => dept.value);
 }, [newUser.businessUnit, departments, lookupDepartments]);

 const managerOptions = useMemo(
  () => existingUsers
    .filter((u) => u.fullName && u.id)
    .map((u) => ({ label: u.employeeCode ? `${u.employeeCode} - ${u.fullName}` : u.fullName, value: u.fullName })),
   [existingUsers]
 );

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
    const [filtersResult, accessProfilesResult, businessUnitsResult, departmentsResult, positionsResult, languagesResult] = await Promise.allSettled([
     settingsApi.getUserFilters(),
     settingsApi.listAllAccessProfiles(),
     dictionaryApi.getBusinessUnits(),
     dictionaryApi.getDepartments(),
     dictionaryApi.getPositions(),
     dictionaryApi.getLanguages(),
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

     setLookupRoles(roles);
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
     setLookupRoles(activeProfiles);
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
       .map((item) => ({ name: item.name, businessUnit: item.businessUnit, isActive: item.isActive }))
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
    const users = usersPage.data ?? [];
    setExistingUsers(users);
    setNewUser((prev) => {
     if (prev.employeeCode.trim()) {
      return prev;
     }
     return {
      ...prev,
      employeeCode: suggestNextEmployeeDigits(users),
     };
    });
   } catch (error) {
    setExistingUsers([]);
    if (import.meta.env.DEV) console.error("Failed to load existing users", error);
   }
  };

  setIsLoading(true);
  void loadLookupOptions();
  void loadExistingUsers();
 }, []);

 const existingUsernames = useMemo(
  () => existingUsers.map((user) => user.username.toLowerCase()),
  [existingUsers]
 );

 const validateForm = (): boolean => {
 const errors: { [key: string]: string } = {};

 if (!newUser.employeeCode) {
 errors.employeeCode = "Employee ID is required";
 } else if (newUser.employeeCode.length !== 4) {
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

 if (!newUser.primaryAccessProfileId) {
 errors.primaryAccessProfileId = "Primary Access Profile is required";
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
  if (!lookupRoles.some((profile) => profile.value === newUser.primaryAccessProfileId)) {
   setFormErrors((prev) => ({ ...prev, primaryAccessProfileId: "Select an active Primary Access Profile" }));
   return;
  }
  const payload = {
   ...newUser,
   employeeCode: `NTP.${newUser.employeeCode}`,
  };

  const created = await settingsApi.createUser(payload);
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

 const employeeCodeDisplay = newUser.employeeCode ? `NTP.${newUser.employeeCode}` : "NTP.";

 const selectedAccessProfileIds = useMemo(
  () => [newUser.primaryAccessProfileId, ...(newUser.additionalAccessProfileIds ?? [])].filter(Boolean) as string[],
  [newUser.primaryAccessProfileId, newUser.additionalAccessProfileIds],
 );
 const { violations: sodViolations, checking: checkingSod, hasBlockingViolation: hasBlockingSodViolation } =
  useSodAccessProfileCheck(selectedAccessProfileIds, true);

 const filteredAccessProfiles = useMemo(() => {
  const q = accessProfileSearch.trim().toLowerCase();
  if (!q) return accessProfiles;
  return accessProfiles.filter(
   (p) => p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q),
  );
 }, [accessProfiles, accessProfileSearch]);

 const toggleAccessProfile = (profile: AccessProfileResponse) => {
  const isPrimary = newUser.primaryAccessProfileId === profile.id;
  const isAdditional = (newUser.additionalAccessProfileIds ?? []).includes(profile.id);

  if (isPrimary) {
   const [nextPrimary, ...restAdditional] = newUser.additionalAccessProfileIds ?? [];
   setNewUser({ ...newUser, primaryAccessProfileId: nextPrimary ?? "", additionalAccessProfileIds: restAdditional });
   return;
  }
  if (isAdditional) {
   setNewUser({
    ...newUser,
    additionalAccessProfileIds: (newUser.additionalAccessProfileIds ?? []).filter((id) => id !== profile.id),
   });
   return;
  }
  // Not selected yet: the first profile picked becomes Primary automatically; later picks are additional.
  if (!newUser.primaryAccessProfileId) {
   setNewUser({ ...newUser, primaryAccessProfileId: profile.id });
   setFormErrors({ ...formErrors, primaryAccessProfileId: "" });
  } else {
   setNewUser({
    ...newUser,
    additionalAccessProfileIds: [...(newUser.additionalAccessProfileIds ?? []), profile.id],
   });
  }
 };

 const makeAccessProfilePrimary = (profile: AccessProfileResponse) => {
  if (newUser.primaryAccessProfileId === profile.id) return;
  const previousPrimary = newUser.primaryAccessProfileId;
  const nextAdditional = (newUser.additionalAccessProfileIds ?? []).filter((id) => id !== profile.id);
  setNewUser({
   ...newUser,
   primaryAccessProfileId: profile.id,
   additionalAccessProfileIds: previousPrimary ? [previousPrimary, ...nextAdditional] : nextAdditional,
  });
  setFormErrors({ ...formErrors, primaryAccessProfileId: "" });
 };
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

  {/* 6-6 two-column layout */}
  <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
   {/* Left col (6) — Personal Info + Education */}
   <div className="xl:col-span-6 space-y-6">
  {/* Personal Information */}
  <FormSection title="Personal Information" icon={<UserIcon className="h-4 w-4" />}>
   <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
    {/* Employee ID */}
    <div>
     <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block">
      Employee ID <span className="text-red-500">*</span>
     </label>
     <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-sm font-medium text-slate-500">NTP.</span>
      <input
       type="text"
       value={newUser.employeeCode}
       onChange={(e) => {
        const value = e.target.value.replace(/\D/g, "").slice(0, 4);
        setNewUser({ ...newUser, employeeCode: value });
        setFormErrors({ ...formErrors, employeeCode: "" });
        setWarnings({ ...warnings, employeeCode: "" });
       }}
       onBlur={(e) => {
        const empCode = e.target.value.trim();
        const formatted = `NTP.${empCode}`;
        if (empCode && existingUsers.some((u) => u.employeeCode === formatted)) {
         setWarnings({ ...warnings, employeeCode: "This Employee ID is already assigned" });
        }
       }}
       placeholder="0008"
       maxLength={4}
       className={cn(
        "w-full h-9 pl-12 pr-3 border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors font-medium",
        formErrors.employeeCode ? "border-red-300 bg-red-50" : warnings.employeeCode ? "border-amber-300 bg-amber-50" : "border-slate-200"
       )}
      />
     </div>
     {formErrors.employeeCode && <p className="text-xs text-red-600 mt-1.5">{formErrors.employeeCode}</p>}
     {!formErrors.employeeCode && warnings.employeeCode && (
      <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1">
       <AlertTriangle className="h-3.5 w-3.5 shrink-0" />{warnings.employeeCode}
      </p>
     )}
    </div>

    {/* Full Name */}
    <div>
     <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block">
      Full Name <span className="text-red-500">*</span>
     </label>
     <input
      type="text"
      value={newUser.fullName}
      onChange={(e) => {
       const name = e.target.value;
       setNewUser(prev => ({
        ...prev,
        fullName: name,
        username: isUsernameEdited ? prev.username : generateUsername(name, existingUsernames),
       }));
       setFormErrors(prev => ({ ...prev, fullName: "" }));
      }}
      placeholder="Nguyễn Thế Hoàng"
      className={cn(
       "w-full h-9 px-3 border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors",
       formErrors.fullName ? "border-red-300 bg-red-50" : "border-slate-200"
      )}
     />
     {formErrors.fullName && <p className="text-xs text-red-600 mt-1.5">{formErrors.fullName}</p>}
    </div>

    {/* Username */}
    <div>
     <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block">
      Username <span className="text-red-500">*</span>
     </label>
     <input
      type="text"
      value={newUser.username}
      onChange={(e) => {
       setIsUsernameEdited(true);
       setNewUser({ ...newUser, username: e.target.value });
       setFormErrors({ ...formErrors, username: "" });
      }}
      placeholder="e.g. hoangnt"
      className={cn(
       "w-full h-9 px-3 border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors",
       formErrors.username ? "border-red-300 bg-red-50" : "border-slate-200"
      )}
     />
     {formErrors.username && <p className="text-xs text-red-600 mt-1.5">{formErrors.username}</p>}
    </div>

    {/* Email */}
    <div>
     <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block">
      Email <span className="text-red-500">*</span>
     </label>
     <input
      type="email"
      value={newUser.email}
      onChange={(e) => {
       const email = e.target.value;
       setNewUser({ ...newUser, email });
       setFormErrors((prev) => ({
        ...prev,
        email: !email.trim() ? "Email is required" : !isValidEmail(email) ? "Invalid email format" : "",
       }));
       setWarnings({ ...warnings, email: "" });
      }}
      onBlur={(e) => {
       const email = e.target.value.trim();
       setFormErrors((prev) => ({
        ...prev,
        email: !email ? "Email is required" : !isValidEmail(email) ? "Invalid email format" : "",
       }));
       if (email && existingUsers.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
        setWarnings({ ...warnings, email: "This email is already in use by another user" });
       }
      }}
      placeholder="john.doe@company.com"
      className={cn(
       "w-full h-9 px-3 border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors",
       formErrors.email ? "border-red-300 bg-red-50" : warnings.email ? "border-amber-300 bg-amber-50" : "border-slate-200"
      )}
     />
     {formErrors.email && <p className="text-xs text-red-600 mt-1.5">{formErrors.email}</p>}
     {!formErrors.email && warnings.email && (
      <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1">
       <AlertTriangle className="h-3.5 w-3.5 shrink-0" />{warnings.email}
      </p>
     )}
    </div>

    {/* Phone */}
    <div>
     <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block">Phone Number</label>
     <input
      type="tel"
      inputMode="numeric"
      pattern="[0-9]*"
      value={newUser.phone}
      onChange={(e) => {
       const phone = normalizeDigitsOnly(e.target.value);
       setNewUser({ ...newUser, phone });
       setFormErrors((prev) => ({
        ...prev,
        phone: phone && !isValidPhone(phone) ? "Phone number must contain 7-15 digits only" : "",
       }));
      }}
      onBlur={(e) => {
       const phone = e.target.value.trim();
       setFormErrors((prev) => ({
        ...prev,
        phone: phone && !isValidPhone(phone) ? "Phone number must contain 7-15 digits only" : "",
       }));
      }}
      placeholder="0123456789"
      className="w-full h-9 px-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
     />
     {formErrors.phone && <p className="text-xs text-red-600 mt-1.5">{formErrors.phone}</p>}
    </div>

    {/* Gender */}
    <Select
     label="Gender"
     value={newUser.gender || ""}
     onChange={(value) => setNewUser({ ...newUser, gender: value as any })}
     options={[
      { label: "Select Gender", value: "" },
      ...lookupGenders,
     ]}
    />

    {/* Date of Birth */}
    <DateTimePicker
     label="Date of Birth"
     value={newUser.dateOfBirth || ""}
     onChange={(v) => {
      setNewUser({ ...newUser, dateOfBirth: v });
      setFormErrors((prev) => ({
       ...prev,
       dateOfBirth: v && isFutureDateValue(v) ? "Date of Birth cannot be in the future" : "",
      }));
     }}
     placeholder="Select date of birth"
    />
    {formErrors.dateOfBirth && <p className="text-xs text-red-600 mt-1.5">{formErrors.dateOfBirth}</p>}

    {/* Nationality */}
    <div>
     <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block">Nationality</label>
     <input
      type="text"
      value={newUser.nationality || ""}
      onChange={(e) => setNewUser({ ...newUser, nationality: e.target.value })}
      placeholder="e.g. Vietnamese"
      className="w-full h-9 px-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors placeholder:text-slate-400"
     />
    </div>

    {/* Language(s) */}
    <div>
     <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block">Language(s)</label>
     <Select
      label=""
      value={newUser.language || ""}
      onChange={(value) => setNewUser({ ...newUser, language: String(value) })}
      options={[
       { label: "Select Language", value: "" },
       ...lookupLanguages,
      ]}
     />
    </div>

    {/* ID / Passport No. */}
    <div>
     <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block">Personal ID / Passport No.</label>
     <input
      type="text"
      value={newUser.idNumber || ""}
      onChange={(e) => setNewUser({ ...newUser, idNumber: e.target.value })}
      placeholder="e.g. 001234567890"
      className="w-full h-9 px-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors placeholder:text-slate-400"
     />
    </div>

    {/* Address */}
    <div className="md:col-span-2">
     <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block">Address</label>
     <input
      type="text"
      value={newUser.address || ""}
      onChange={(e) => setNewUser({ ...newUser, address: e.target.value })}
      placeholder="e.g. 123 Main Street, City, Country"
      className="w-full h-9 px-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors placeholder:text-slate-400"
     />
    </div>
   </div>
  </FormSection>


  {/* Education & Professional Background */}
  <FormSection title="Education & Professional Background" icon={<GraduationCap className="h-4 w-4" />}>
   <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
    {/* Highest Degree */}
    <div>
     <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block">Highest Degree</label>
     <input
      type="text"
      value={newUser.degree || ""}
      onChange={(e) => setNewUser({ ...newUser, degree: e.target.value })}
      placeholder="e.g. Bachelor of Science"
      className="w-full h-9 px-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors placeholder:text-slate-400"
     />
    </div>

    {/* Field of Study */}
    <div>
     <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block">Field of Study</label>
     <input
      type="text"
      value={newUser.fieldOfStudy || ""}
      onChange={(e) => setNewUser({ ...newUser, fieldOfStudy: e.target.value })}
      placeholder="e.g. Pharmaceutical Sciences"
      className="w-full h-9 px-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors placeholder:text-slate-400"
     />
    </div>

    {/* Institution */}
    <div className="md:col-span-2">
     <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block">Institution</label>
     <input
      type="text"
      value={newUser.institution || ""}
      onChange={(e) => setNewUser({ ...newUser, institution: e.target.value })}
      placeholder="e.g. Hanoi University of Pharmacy"
      className="w-full h-9 px-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors placeholder:text-slate-400"
     />
    </div>

    {/* Graduation Year */}
    <div>
     <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block">Graduation Year</label>
     <input
      type="text"
      value={newUser.graduationYear || ""}
      onChange={(e) => setNewUser({ ...newUser, graduationYear: e.target.value })}
      placeholder="e.g. 2018"
      className="w-full h-9 px-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors placeholder:text-slate-400"
     />
    </div>

    {/* GPA / Grade */}
    <div>
     <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block">GPA / Grade</label>
     <input
      type="text"
      value={newUser.gpa || ""}
      onChange={(e) => setNewUser({ ...newUser, gpa: e.target.value })}
      placeholder="e.g. 3.8 / 4.0"
      className="w-full h-9 px-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors placeholder:text-slate-400"
     />
    </div>

    {/* Professional Level */}
    <div className="md:col-span-2">
     <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block">Professional Level</label>
     <input
      type="text"
      value={newUser.professionalLevel || ""}
      onChange={(e) => setNewUser({ ...newUser, professionalLevel: e.target.value })}
      placeholder="e.g. Senior / Manager"
      className="w-full h-9 px-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors placeholder:text-slate-400"
     />
    </div>

    {/* Area of Expertise */}
    <div className="md:col-span-2">
     <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block">Area of Expertise</label>
     <input
      type="text"
      value={newUser.areaOfExpertise || ""}
      onChange={(e) => setNewUser({ ...newUser, areaOfExpertise: e.target.value })}
      placeholder="e.g. Quality Assurance, Regulatory Affairs"
      className="w-full h-9 px-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors placeholder:text-slate-400"
     />
    </div>

    {/* Years of Experience */}
    <div>
     <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block">Years of Experience</label>
     <input
      type="text"
      value={newUser.yearsOfExperience || ""}
      onChange={(e) => setNewUser({ ...newUser, yearsOfExperience: e.target.value })}
      placeholder="e.g. 5"
      className="w-full h-9 px-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors placeholder:text-slate-400"
     />
    </div>

    {/* Previous Employer */}
    <div>
     <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block">Previous Employer</label>
     <input
      type="text"
      value={newUser.previousEmployer || ""}
      onChange={(e) => setNewUser({ ...newUser, previousEmployer: e.target.value })}
      placeholder="e.g. ABC Pharma Co."
      className="w-full h-9 px-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors placeholder:text-slate-400"
     />
    </div>
   </div>
  </FormSection>
   </div>{/* end left col */}

   {/* Right col (6) — Work + Account */}
   <div className="xl:col-span-6 space-y-6">
  {/* Work & Professional Profile */}
  <FormSection title="Work & Professional Profile" icon={<Briefcase className="h-4 w-4" />}>
   <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
    {/* Business Unit */}
    <div>
     <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block">
      Business Unit <span className="text-red-500">*</span>
     </label>
     <Select
     label=""
     value={newUser.businessUnit}
     onChange={(value) => { setNewUser({ ...newUser, businessUnit: value, department: "", position: "" }); setFormErrors({ ...formErrors, businessUnit: "", department: "", position: "" }); }}
      options={[
       { label: "Select Business Unit", value: "" },
       ...businessUnitOptions
      ]}
     />
     {formErrors.businessUnit && <p className="text-xs text-red-600 mt-1.5">{formErrors.businessUnit}</p>}
    </div>

    {/* Department */}
    <div>
     <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block">
      Department <span className="text-red-500">*</span>
     </label>
     <Select
      label=""
      value={newUser.department}
      onChange={(value) => { setNewUser({ ...newUser, department: value, position: "" }); setFormErrors({ ...formErrors, department: "", position: "" }); }}
     options={[
       { label: newUser.businessUnit ? "Select Department" : "Select Business Unit first", value: "" },
       ...departmentOptions
      ]}
      disabled={!newUser.businessUnit}
     />
     {formErrors.department && <p className="text-xs text-red-600 mt-1.5">{formErrors.department}</p>}
    </div>

    {/* Position */}
    <div className="md:col-span-2">
     <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block">
      Position <span className="text-red-500">*</span>
     </label>
     <Select
      label=""
      value={newUser.position || ""}
      onChange={(value) => { setNewUser({ ...newUser, position: value }); setFormErrors({ ...formErrors, position: "" }); }}
      options={positionOptionsWithFallback}
      placeholder="Select Position"
      disabled={!newUser.businessUnit || !newUser.department}
     />
     {(!newUser.businessUnit || !newUser.department) && (
      <p className="text-xs text-slate-400 mt-1.5">Select Business Unit and Department first to see available positions</p>
     )}
     {formErrors.position && <p className="text-xs text-red-600 mt-1.5">{formErrors.position}</p>}
    </div>

    {/* Employment Type */}
    <div>
     <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block">
      Employment Type <span className="text-red-500">*</span>
     </label>
    <Select
      label=""
      value={newUser.employmentType || ""}
      onChange={(value) => { setNewUser({ ...newUser, employmentType: value as any }); setFormErrors({ ...formErrors, employmentType: "" }); }}
      options={[
       { label: "Select Employment Type", value: "" },
       ...lookupEmploymentTypes,
      ]}
     />
     {formErrors.employmentType && <p className="text-xs text-red-600 mt-1.5">{formErrors.employmentType}</p>}
    </div>

    {/* Start Date */}
    <div>
     <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block">
      Start Date <span className="text-red-500">*</span>
     </label>
     <DateTimePicker
      label=""
      value={newUser.startDate || ""}
      onChange={(v) => {
       setNewUser({ ...newUser, startDate: v });
       setFormErrors((prev) => ({
        ...prev,
        startDate: !v ? "Start Date is required" : isFutureDateValue(v) ? "Start Date cannot be in the future" : "",
       }));
      }}
      placeholder="Select start date"
     />
     {formErrors.startDate && <p className="text-xs text-red-600 mt-1.5">{formErrors.startDate}</p>}
    </div>

    {/* Direct Manager */}
    <div className="md:col-span-2">
     <Select
      label="Direct Manager"
      value={newUser.managerName || ""}
      onChange={(value) => setNewUser({ ...newUser, managerName: value })}
      options={[
       { label: "Select Manager", value: "" },
       ...managerOptions,
      ]}
      enableSearch
      onSearch={searchManagerOptions}
     />
    </div>
   </div>
  </FormSection>

  {/* Account & Access Control */}
  <FormSection title="Account & Access Control" icon={<Shield className="h-4 w-4" />}>
   <div className="grid grid-cols-1 gap-y-5">
    <div>
     <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block">
      Access Profiles <span className="text-red-500">*</span>
     </label>
     <p className="text-xs text-slate-500 mb-2">
      Select every Access Profile this user needs. The first one picked becomes the <b>Primary</b> profile — click the star on any other selected profile to make it primary instead. Access is cumulative across all selected profiles.
     </p>

     {sodViolations.length > 0 && (
      <div className="mb-3">
       <SodViolationPanel violations={sodViolations} />
      </div>
     )}

     <div className="flex flex-wrap items-center gap-3 mb-2">
      <div className="relative flex-1 max-w-md">
       <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
       <input
        className="w-full h-9 pl-9 pr-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors placeholder:text-slate-400"
        value={accessProfileSearch}
        onChange={(e) => setAccessProfileSearch(e.target.value)}
        placeholder="Search access profiles…"
       />
      </div>
      {selectedAccessProfileIds.length > 0 && (
       <button
        type="button"
        onClick={() => setNewUser({ ...newUser, primaryAccessProfileId: "", additionalAccessProfileIds: [] })}
        className="text-xs font-medium text-slate-500 hover:text-red-600 transition-colors whitespace-nowrap"
       >
        Clear All ({selectedAccessProfileIds.length})
       </button>
      )}
     </div>

     <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 max-h-[320px] overflow-y-auto">
      {filteredAccessProfiles.length === 0 && (
       <p className="p-4 text-sm text-slate-400">No access profiles match your search.</p>
      )}
      {filteredAccessProfiles.map((profile) => {
       const isPrimary = newUser.primaryAccessProfileId === profile.id;
       const isSelected = isPrimary || (newUser.additionalAccessProfileIds ?? []).includes(profile.id);
       return (
        <div
         key={profile.id}
         className={cn(
          "flex items-start gap-3 px-4 py-3 transition-colors",
          isPrimary ? "bg-emerald-50/60" : "hover:bg-slate-50",
         )}
        >
         <label className="flex items-start gap-3 flex-1 min-w-0 cursor-pointer">
          <Checkbox
           id={`new-user-access-profile-${profile.id}`}
           checked={isSelected}
           onChange={() => toggleAccessProfile(profile)}
          />
          <span className="min-w-0 flex-1">
           <span className="flex flex-wrap items-center gap-2">
            <span className="text-xs sm:text-sm font-medium text-slate-800">{profile.name}</span>
            {isPrimary && (
             <Badge color="emerald" size="sm" pill>Primary</Badge>
            )}
           </span>
          </span>
         </label>
         {isSelected && !isPrimary && (
          <button
           type="button"
           onClick={() => makeAccessProfilePrimary(profile)}
           title="Set as Primary Access Profile"
           className="flex-shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-amber-500 hover:bg-amber-50 transition-colors"
          >
           <Star className="h-4 w-4" />
          </button>
         )}
        </div>
       );
      })}
     </div>
     <p className="mt-1.5 text-xs text-slate-500">Segregation-of-duties conflicts are checked live as you select profiles.</p>
     {formErrors.primaryAccessProfileId && <p className="text-xs text-red-600 mt-1.5">{formErrors.primaryAccessProfileId}</p>}
    </div>
    <div>
     <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block">
      Account Status <span className="text-red-500">*</span>
     </label>
     <Select
      label=""
      value={newUser.status}
      onChange={(value) => { setNewUser({ ...newUser, status: value as any }); setFormErrors({ ...formErrors, status: "" }); }}
      options={[
       { label: "Select Account Status", value: "" },
       ...lookupStatuses,
      ]}
     />
     {formErrors.status && <p className="text-xs text-red-600 mt-1.5">{formErrors.status}</p>}
    </div>
   </div>
   {canInviteExternal && (
    <div className="mt-4 flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
      <Checkbox
        checked={Boolean(newUser.inviteExternal)}
        onChange={(checked) => setNewUser({ ...newUser, inviteExternal: checked })}
        className="mt-0.5 shrink-0"
      />
      <span>
        <span className="block font-medium">Invite as Microsoft Entra guest</span>
        <span className="mt-1 block text-xs text-slate-500">Sends a guest invitation only; no Microsoft 365 license, group, or SharePoint site access is granted automatically.</span>
      </span>
    </div>
   )}
  </FormSection>
   </div>{/* end right col */}
  </div>{/* end 6-6 grid */}

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
