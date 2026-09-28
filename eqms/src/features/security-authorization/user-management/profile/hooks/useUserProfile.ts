import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/ui/toast";
import { settingsApi } from "@/services/api/settings";
import { dictionaryApi } from "@/services/api";
import type { User, Certification, EducationItem } from "../../types";
import type { SectionKey } from "../components/ProfileSectionCard";
import { useAuth } from "@/contexts/AuthContext";
import {
  isAvatarFileWithinLimit,
  isSupportedAvatarFile,
  readFileAsDataUrl,
} from "@/utils/avatar";
import { isValidEmail, isValidPhone, normalizeDigitsOnly } from "../validation";

const createEmptyUser = (): User => ({
  id: "",
  employeeCode: "",
  fullName: "",
  username: "",
  email: "",
  phone: "",
  role: "User",
  position: "",
  businessUnit: "",
  department: "",
  status: "Pending",
  lastLogin: "Never",
  createdDate: "",
  lastUpdated: "",
  permissions: [],
});

const SECTION_FIELDS: Record<SectionKey, (keyof User)[]> = {
  personal: [
    "employeeCode",
    "fullName",
    "phone",
    "username",
    "email",
    "gender",
    "dateOfBirth",
    "nationality",
    "language",
    "idNumber",
    "address",
  ],
  work: [
    "businessUnit",
    "department",
    "position",
    "employmentType",
    "startDate",
    "managerName",
  ],
  account: ["role", "status", "homePage"],
  expertise: [
    "professionalLevel",
    "areaOfExpertise",
    "yearsOfExperience",
    "previousEmployer",
  ],
  education: [],
};

/** Edit mode is unified for the WHOLE page now, not per tab or per card -- one "Edit" click at
 *  the page title enables every plain field shown across Personal Information, Professional
 *  Qualifications, and the MFA requirement checkbox, and one "Save" persists them all together
 *  in a single PATCH. Access Profiles (needs its own e-signature per change) and
 *  Education/Certifications (row add/edit/delete with file uploads) are deliberately NOT part of
 *  this draft/save cycle -- they keep their own always-available instant-action UI, matching how
 *  they already worked. */
const PAGE_EDITABLE_FIELDS: (keyof User)[] = [
  ...SECTION_FIELDS.personal,
  ...SECTION_FIELDS.work,
  ...SECTION_FIELDS.account,
  ...SECTION_FIELDS.expertise,
  "mfaRequiredByAdmin",
];

export function useUserProfile(userId: string | undefined) {
  const { showToast } = useToast();
  const { user: currentAuthUser, updateUser: updateAuthUser } = useAuth();
  const [userData, setUserData] = useState<User>(createEmptyUser);
  const [draft, setDraft] = useState<User>(createEmptyUser);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [sectionOriginal, setSectionOriginal] = useState<User | null>(null);
  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [educationList, setEducationList] = useState<EducationItem[]>([]);
  const [managerCandidates, setManagerCandidates] = useState<
    { id: string; label: string; value: string }[]
  >([]);
  const [businessUnits, setBusinessUnits] = useState<
    { name: string; isActive?: boolean }[]
  >([]);
  const [departments, setDepartments] = useState<
    { name: string; businessUnit: string }[]
  >([]);
  const [positions, setPositions] = useState<
    {
      name: string;
      businessUnit: string;
      department: string;
      isActive?: boolean;
    }[]
  >([]);
  const [languages, setLanguages] = useState<
    { label: string; value: string }[]
  >([]);
  const [avatarPreview, setAvatarPreview] = useState<string>("");
  const [isAvatarSaving, setIsAvatarSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ [key: string]: string | undefined }>({});

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!userId) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);

      // Only the profile record is critical for the first paint.  The remaining requests are
      // optional editor/tab data and run concurrently in the background instead of holding the
      // whole page behind the former /settings/users?limit=1000 admin-list request.
      const supportingDataPromise = Promise.all([
        settingsApi.getUserManagerOptions().catch(() => []),
        settingsApi.getUserEducation(userId).catch(() => []),
        settingsApi.getUserCertifications(userId).catch(() => []),
        dictionaryApi.getBusinessUnits().catch(() => []),
        dictionaryApi.getDepartments().catch(() => []),
        dictionaryApi.getPositions().catch(() => []),
        dictionaryApi.getLanguages().catch(() => []),
      ]);

      try {
        const user = await settingsApi.getUserById(userId, { includeDetails: false });

        if (!active) return;

        setUserData(user);
        setDraft(user);
        setAvatarPreview(user.avatar || "");
      } catch (error) {
        if (active) {
          if (import.meta.env.DEV)
            console.error("Failed to load user profile", error);
          showToast({
            type: "error",
            title: "Load Failed",
            message: "Unable to load user profile.",
          });
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }

      const [
        managers,
        education,
        certificationsResponse,
        dictionaryBusinessUnits,
        dictionaryDepartments,
        dictionaryPositions,
        dictionaryLanguages,
      ] = await supportingDataPromise;

      if (!active) return;

      setManagerCandidates(managers);
      setCertifications(certificationsResponse as Certification[]);
      setEducationList(education as EducationItem[]);
      setBusinessUnits(
        dictionaryBusinessUnits
          .filter((item) => item.isActive !== false)
          .map((item) => ({ name: item.name, isActive: item.isActive })),
      );
      setDepartments(
        dictionaryDepartments.map((item) => ({
          name: item.name,
          businessUnit: item.businessUnit,
        })),
      );
      setPositions(
        dictionaryPositions
          .filter((item) => item.isActive !== false)
          .map((item) => ({
            name: item.name,
            businessUnit: item.businessUnit,
            department: item.department,
            isActive: item.isActive,
          })),
      );
      setLanguages(dictionaryLanguages);
    };

    load();
    return () => {
      active = false;
    };
  }, [userId, showToast]);

  const isDraftDirty =
    sectionOriginal !== null &&
    JSON.stringify(draft) !== JSON.stringify(sectionOriginal);

  const draftDepartments = useMemo(
    () =>
      draft.businessUnit
        ? departments
            .filter((dept) => dept.businessUnit === draft.businessUnit)
            .map((dept) => dept.name)
        : [],
    [draft.businessUnit, departments],
  );

  const businessUnitOptions = useMemo(
    () => businessUnits.map((item) => ({ label: item.name, value: item.name })),
    [businessUnits],
  );

  const lookupPositions = useMemo(
    () =>
      draft.businessUnit && draft.department
        ? positions
            .filter(
              (position) =>
                position.businessUnit === draft.businessUnit &&
                position.department === draft.department &&
                position.isActive !== false,
            )
            .map((position) => ({ label: position.name, value: position.name }))
        : [],
    [draft.businessUnit, draft.department, positions],
  );

  const managerOptions = useMemo(
    () =>
      managerCandidates
        .filter((candidate) => candidate.id !== userData.id)
        .map((candidate) => ({
          label: candidate.label,
          value: candidate.value,
        })),
    [managerCandidates, userData.id],
  );

  const initials = userData.fullName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const yearsOfService = userData.startDate
    ? (() => {
        // Calendar-accurate diff (borrowing days/months as needed) instead of dividing by
        // average millisecond constants, which drifts by a day or more near month boundaries.
        const start = new Date(userData.startDate);
        const now = new Date();
        let years = now.getFullYear() - start.getFullYear();
        let months = now.getMonth() - start.getMonth();
        let days = now.getDate() - start.getDate();
        if (days < 0) {
          months -= 1;
          days += new Date(now.getFullYear(), now.getMonth(), 0).getDate();
        }
        if (months < 0) {
          years -= 1;
          months += 12;
        }
        const parts: string[] = [];
        if (years > 0) parts.push(`${years} yr${years > 1 ? "s" : ""}`);
        if (months > 0) parts.push(`${months} mo${months > 1 ? "s" : ""}`);
        if (days > 0 || parts.length === 0)
          parts.push(`${days} day${days !== 1 ? "s" : ""}`);
        return parts.join(" ");
      })()
    : null;

  const startEdit = () => {
    setSectionOriginal({ ...userData });
    setDraft({ ...userData });
    setFieldErrors({});
    setIsEditingProfile(true);
    const phone = (userData.phone || "").trim();
    const email = (userData.email || "").trim();
    setFieldErrors({
      ...(phone && !isValidPhone(phone)
        ? { phone: "Phone number must contain 7-15 digits only" }
        : {}),
      ...(email && !isValidEmail(email)
        ? { email: "Invalid email format" }
        : !email
          ? { email: "Email is required" }
          : {}),
    });
  };

  const validatePersonalSection = () => {
    const errors: { phone?: string; email?: string; employeeCode?: string } = {};
    const phone = (draft.phone || "").trim();
    const email = (draft.email || "").trim();
    const employeeCode = (draft.employeeCode || "").trim();
    if (phone && !isValidPhone(phone)) {
      errors.phone = "Phone number must contain 7-15 digits only";
    }
    if (!email) {
      errors.email = "Email is required";
    } else if (!isValidEmail(email)) {
      errors.email = "Invalid email format";
    }
    if (!employeeCode) {
      errors.employeeCode = "Employee ID is required";
    } else if (!/^NTP\.\d{4}$/.test(employeeCode)) {
      errors.employeeCode = "Employee ID must be 4 digits";
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const saveAll = async () => {
    try {
      if (!validatePersonalSection()) {
        showToast({
          type: "error",
          title: "Validation Failed",
          message: "Please fix the highlighted fields.",
        });
        return;
      }
      const sourceDraft = {
        ...draft,
        phone: (draft.phone || "").trim(),
        email: (draft.email || "").trim(),
      };

      const delta: Partial<User> = {};
      const fieldsToCheck = PAGE_EDITABLE_FIELDS;

      fieldsToCheck.forEach((k) => {
        if (JSON.stringify(sourceDraft[k]) !== JSON.stringify(userData[k])) {
          (delta as any)[k] = sourceDraft[k];
        }
      });

      const avatarChanged = (avatarPreview || "") !== (userData.avatar || "");
      if (avatarChanged) {
        delta.avatar = avatarPreview || "";
      }

      if (Object.keys(delta).length === 0) {
        showToast({
          type: "info",
          title: "No changes",
          message: "Nothing changed, so there is nothing to save.",
        });
        setSectionOriginal(null);
        setIsEditingProfile(false);
        return;
      }

      const updated = await settingsApi.updateUser(userData.id, delta);
      setUserData(updated);
      setDraft(updated);
      setAvatarPreview(updated.avatar || "");
      setSectionOriginal(null);
      setIsEditingProfile(false);
      setFieldErrors({});
      if (currentAuthUser?.id === updated.id) {
        updateAuthUser({ ...currentAuthUser, avatar: updated.avatar || "" });
      }
      showToast({
        type: "success",
        title: "Changes saved",
        message: "Profile information updated successfully.",
      });
    } catch (error: any) {
      // API errors use { error: { code, message, details } }.  Older endpoints
      // may still return { body: ... }, so accept both during the transition.
      const responseData = error.response?.data;
      const body = responseData?.error ?? responseData?.body ?? responseData;
      if (body && typeof body === "object") {
        if (body.code === "VALIDATION_ERROR" && body.details) {
          const newErrors: { [key: string]: string } = {};
          body.details.forEach((detail: any) => {
            newErrors[detail.field] = detail.message;
          });
          setFieldErrors((prev) => ({ ...prev, ...newErrors }));
          showToast({
            type: "error",
            title: "Validation Failed",
            message: "Please fix the highlighted fields.",
          });
          return;
        } else if (body.code === "BAD_REQUEST") {
          showToast({
            type: "error",
            title: "Save Failed",
            message: body.message,
          });
          return;
        }
      }
      showToast({
        type: "error",
        title: "Save Failed",
        message:
          body?.message || "The profile could not be saved. Please try again.",
      });
    }
  };

  const cancelEdit = () => {
    setDraft({ ...userData });
    setAvatarPreview(userData.avatar || "");
    setSectionOriginal(null);
    setIsEditingProfile(false);
    setFieldErrors({});
  };

  const resetEdit = () => {
    if (sectionOriginal) setDraft({ ...sectionOriginal });
    setFieldErrors({});
  };

  const updateMfaRequiredByAdmin = (value: boolean) => {
    setDraft((prev) => ({ ...prev, mfaRequiredByAdmin: value }));
  };

  const updateField = (key: keyof User, value: string) => {
    if (key === "phone") {
      const normalized = normalizeDigitsOnly(value);
      setDraft((prev) => ({ ...prev, phone: normalized }));
      setFieldErrors((prev) => ({
        ...prev,
        phone:
          normalized.length > 0 && !isValidPhone(normalized)
            ? "Phone number must contain 7-15 digits only"
            : undefined,
      }));
      return;
    }
    if (key === "email") {
      const normalized = value.trim();
      setDraft((prev) => ({ ...prev, email: normalized }));
      setFieldErrors((prev) => ({
        ...prev,
        email:
          normalized.length > 0 && !isValidEmail(normalized)
            ? "Invalid email format"
            : normalized.length === 0
              ? "Email is required"
              : undefined,
      }));
      return;
    }
    setDraft((prev) => {
      const updated = { ...prev, [key]: value };
      if (key === "businessUnit") {
        updated.department = "";
        updated.position = "";
      }
      if (key === "department") {
        updated.position = "";
      }
      return updated;
    });
  };

  const saveCert = async (
    data: Omit<Certification, "id">,
    editing: Certification | null,
    file: File | null,
  ) => {
    try {
      if (editing) {
        let updated = await settingsApi.updateUserCertification(
          userData.id,
          editing.id,
          {
            name: data.name,
            issuingOrg: data.issuingOrg,
            issueDate: data.issueDate,
            expiryDate: data.expiryDate,
          },
        );
        if (file) {
          updated = await settingsApi.uploadUserCertificationFile(
            userData.id,
            editing.id,
            file,
          );
        }
        const next = certifications.map((c) =>
          c.id === editing.id ? (updated as Certification) : c,
        );
        setCertifications(next);
        showToast({
          type: "success",
          title: "Certificate updated",
          message: "Certificate has been updated successfully.",
        });
      } else {
        let created = (await settingsApi.addUserCertification(userData.id, {
          name: data.name,
          issuingOrg: data.issuingOrg,
          issueDate: data.issueDate,
          expiryDate: data.expiryDate,
        })) as Certification;
        if (file) {
          created = (await settingsApi.uploadUserCertificationFile(
            userData.id,
            created.id,
            file,
          )) as Certification;
        }
        setCertifications((prev) => [...prev, created as Certification]);
        showToast({
          type: "success",
          title: "Certificate added",
          message: "Certificate has been added successfully.",
        });
      }
    } catch (error) {
      showToast({
        type: "error",
        title: "Certificate Save Failed",
        message: String(error),
      });
    }
  };

  const deleteCert = async (id: string) => {
    try {
      await settingsApi.deleteUserCertification(userData.id, id);
      setCertifications((prev) => prev.filter((c) => c.id !== id));
      showToast({
        type: "success",
        title: "Certificate removed",
        message: "Certificate has been removed.",
      });
    } catch (error) {
      showToast({
        type: "error",
        title: "Delete Failed",
        message: String(error),
      });
    }
  };

  const saveEdu = async (
    data: Omit<EducationItem, "id">,
    editing: EducationItem | null,
  ) => {
    try {
      if (editing) {
        const updated = await settingsApi.updateUserEducation(
          userData.id,
          editing.id,
          {
            degree: data.degree,
            fieldOfStudy: data.fieldOfStudy,
            institution: data.institution,
            graduationYear: data.graduationYear,
            gpa: data.gpa,
          },
        );
        setEducationList((prev) =>
          prev.map((e) =>
            e.id === editing.id ? (updated as EducationItem) : e,
          ),
        );
        showToast({
          type: "success",
          title: "Education experience updated",
          message: "Education detail has been updated successfully.",
        });
      } else {
        const created = await settingsApi.addUserEducation(userData.id, {
          degree: data.degree,
          fieldOfStudy: data.fieldOfStudy,
          institution: data.institution,
          graduationYear: data.graduationYear,
          gpa: data.gpa,
        });
        setEducationList((prev) => [created as EducationItem, ...prev]);
        showToast({
          type: "success",
          title: "Education experience added",
          message: "Education detail has been added successfully.",
        });
      }
    } catch (error) {
      showToast({
        type: "error",
        title: "Education Save Failed",
        message: String(error),
      });
    }
  };

  const deleteEdu = async (id: string) => {
    try {
      await settingsApi.deleteUserEducation(userData.id, id);
      setEducationList((prev) => prev.filter((e) => e.id !== id));
      showToast({
        type: "success",
        title: "Education experience removed",
        message: "Education entry has been removed.",
      });
    } catch (error) {
      showToast({
        type: "error",
        title: "Delete Failed",
        message: String(error),
      });
    }
  };

  const suspendUser = async (reason: string, suspendedUntil: string, signatureToken: string) => {
    try {
      const updated = await settingsApi.suspendUser(userData.id, {
        reason,
        suspendedUntil,
        signatureToken,
      });
      setUserData(updated);
      setDraft(updated);
      showToast({
        type: "warning",
        title: "User Suspended",
        message: `${userData.fullName} has been suspended.`,
      });
    } catch (error) {
      showToast({
        type: "error",
        title: "Suspend Failed",
        message: String(error),
      });
    }
  };

  const terminateUser = async (reason: string, terminationDate: string, signatureToken: string) => {
    try {
      const updated = await settingsApi.terminateUser(userData.id, {
        reason,
        terminationDate,
        signatureToken,
      });
      setUserData(updated);
      setDraft(updated);
      showToast({
        type: "error",
        title: "Employee Terminated",
        message: `${userData.fullName} has been terminated.`,
      });
    } catch (error) {
      showToast({
        type: "error",
        title: "Terminate Failed",
        message: String(error),
      });
    }
  };

  const reinstateUser = async () => {
    try {
      const updated = await settingsApi.reinstateUser(userData.id);
      setUserData(updated);
      setDraft(updated);
      showToast({
        type: "success",
        title: "User Reinstated",
        message: `${userData.fullName} has been reinstated as Active.`,
      });
    } catch (error) {
      showToast({
        type: "error",
        title: "Reinstate Failed",
        message: String(error),
      });
    }
  };

  /** UnlockAccountModal calls settingsApi.unlockUser itself (self-contained, mirroring
   * ResetPasswordModal) since it needs the returned temporary password to display -- this just
   * lets the view push the updated User back into hook state afterward. */
  const setUser = (updated: User) => {
    setUserData(updated);
    setDraft(updated);
  };

  const handleAvatarChange = async (file: File) => {
    if (!isSupportedAvatarFile(file)) {
      showToast({
        type: "error",
        title: "Error",
        message: "Only .png or .jpg files are accepted.",
      });
      return;
    }
    if (!isAvatarFileWithinLimit(file)) {
      showToast({
        type: "error",
        title: "Error",
        message: "File size exceeds 5MB limit.",
      });
      return;
    }

    try {
      setIsAvatarSaving(true);
      const dataUrl = await readFileAsDataUrl(file);
      setAvatarPreview(dataUrl);
    } catch (error) {
      setAvatarPreview(userData.avatar || "");
      showToast({
        type: "error",
        title: "Avatar Update Failed",
        message: String(error),
      });
    } finally {
      setIsAvatarSaving(false);
    }
  };

  return {
    user: userData,
    draft,
    isEditingProfile,
    isDraftDirty,
    certifications,
    draftDepartments,
    managerOptions,
    initials,
    yearsOfService,
    startEdit,
    saveAll,
    cancelEdit,
    resetEdit,
    updateField,
    updateMfaRequiredByAdmin,
    saveCert,
    deleteCert,
    educationList,
    saveEdu,
    deleteEdu,
    suspendUser,
    terminateUser,
    reinstateUser,
    setUser,
    lookupPositions,
    businessUnitOptions,
    languageOptions: languages,
    avatarPreview,
    isAvatarSaving,
    handleAvatarChange,
    fieldErrors,
    isLoading,
  };
}
