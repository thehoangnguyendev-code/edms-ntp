export interface EducationDegreeLevelItem {
  id: string;
  name: string;
  displayOrder: number;
  isActive: boolean;
  createdDate: string;
  modifiedDate: string;
}

export type SchoolType = "UNIVERSITY" | "COLLEGE" | "ACADEMY" | "VOCATIONAL_SECONDARY" | "TRADE_SCHOOL" | "INTERNATIONAL_PROGRAM" | "OTHER";
export type SchoolOwnership = "PUBLIC" | "PRIVATE" | "FOREIGN_INVESTED";

export const SCHOOL_TYPE_OPTIONS: { label: string; value: SchoolType }[] = [
  { label: "Đại học (University)", value: "UNIVERSITY" },
  { label: "Cao đẳng (College)", value: "COLLEGE" },
  { label: "Học viện (Academy)", value: "ACADEMY" },
  { label: "Trường trung cấp (Vocational Secondary)", value: "VOCATIONAL_SECONDARY" },
  { label: "Trường nghề (Trade School)", value: "TRADE_SCHOOL" },
  { label: "Chương trình/cơ sở quốc tế", value: "INTERNATIONAL_PROGRAM" },
  { label: "Khác", value: "OTHER" },
];

export const SCHOOL_OWNERSHIP_OPTIONS: { label: string; value: SchoolOwnership }[] = [
  { label: "Công lập (Public)", value: "PUBLIC" },
  { label: "Tư thục (Private)", value: "PRIVATE" },
  { label: "Có vốn đầu tư nước ngoài (Foreign-invested)", value: "FOREIGN_INVESTED" },
];

export interface SchoolItem {
  id: string; name: string; abbreviation?: string | null; type: SchoolType; ownership?: SchoolOwnership | null;
  isActive: boolean; createdDate: string; modifiedDate: string; catalogId?: string | null; slug?: string | null;
  entityKind?: string | null; isIndependentInstitution?: boolean | null; institutionType?: string | null;
  institutionTypeLabel?: string | null; presenceType?: string | null; operationalStatus?: string | null;
  verifiedAsOf?: string | null; verificationStatus?: string | null; governingBody?: string | null;
  governingBodyType?: string | null; governingBodyVerificationStatus?: string | null;
  nationalEducationRegulator?: string | null; governanceModel?: string | null;
  directGoverningMinistry?: string | null; countryOfOriginName?: string | null;
  countryOfOriginIso2?: string | null; hostInVietnam?: string | null; parentOrPartner?: string | null;
  supervisingAuthority?: string | null; ultimateGoverningBody?: string | null;
  ownershipVerificationStatus?: string | null; statusNote?: string | null; governingBodySourceUrls?: string[] | null;
}

export type EducationDegreeLevelPayload = { name: string; displayOrder?: number; isActive: boolean };
export type SchoolPayload = Omit<SchoolItem, "id" | "createdDate" | "modifiedDate" | "catalogId" | "slug">;
export type EducationListParams = { search?: string; status?: "All" | "Active" | "Inactive"; modifiedFrom?: string; modifiedTo?: string; page?: number; limit?: number; sortBy?: string; sortDirection?: "asc" | "desc" };
export type SchoolListParams = EducationListParams & { type?: string; ownership?: string; governingBody?: string; countryOfOriginName?: string; independentInstitution?: boolean };
