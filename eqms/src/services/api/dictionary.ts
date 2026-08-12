import { api } from './client';
import type {
  BusinessUnitItem,
  DepartmentItem,
  DocumentTypeItem,
  DocumentSubTypeItem,
  PositionItem,
  RetentionPolicyItem,
  StorageLocationItem,
} from '@/features/settings/dictionaries/types';

export type DictionaryListParams = {
  search?: string;
  status?: 'All' | 'Active' | 'Inactive';
  modifiedFrom?: string;
  modifiedTo?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
};

export type DepartmentDictionaryListParams = DictionaryListParams & {
  businessUnit?: string;
};

export type PositionDictionaryListParams = DictionaryListParams & {
  businessUnit?: string;
  department?: string;
};

export type DocumentSubTypeDictionaryListParams = DictionaryListParams & {
  documentType?: string;
};

type PageResponse<T> = {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

type ApiBusinessUnit = {
  id: string;
  name: string;
  abbreviation: string;
  description?: string | null;
  isActive: boolean;
  createdDate: string;
  modifiedDate: string;
  departmentCount: number;
};

type ApiDepartment = {
  id: string;
  name: string;
  abbreviation: string;
  businessUnit: string;
  description?: string | null;
  isActive: boolean;
  createdDate: string;
  modifiedDate: string;
  positionCount: number;
};

type ApiPosition = {
  id: string;
  name: string;
  abbreviation: string;
  businessUnit: string;
  department: string;
  description?: string | null;
  isActive: boolean;
  createdDate: string;
  modifiedDate: string;
};

type ApiDocumentType = {
  id: string;
  name: string;
  shortCode: string;
  currentSequence: number;
  lastIssuedDocumentNumber?: string | null;
  nextDocumentNumber?: string | null;
  description?: string | null;
  isActive: boolean;
  createdDate: string;
  modifiedDate: string;
};

type ApiDocumentSubType = {
  id: string;
  name: string;
  documentTypeId: string;
  documentType: string;
  description?: string | null;
  reviewRequirement?: "NONE" | "SINGLE" | "MULTIPLE";
  isActive: boolean;
  createdDate: string;
  modifiedDate: string;
};

type ApiStorageLocation = {
  id: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  createdDate: string;
  modifiedDate: string;
};

type ApiRetentionPolicy = {
  id: string;
  name: string;
  description?: string | null;
  retentionDays?: number | null;
  isActive: boolean;
  createdDate: string;
  modifiedDate: string;
};

type ApiLanguage = {
  id: string;
  name: string;
  code: string;
  label: string;
  value: string;
};

export type DictionaryBusinessUnitPayload = {
  name: string;
  abbreviation: string;
  description?: string;
  isActive: boolean;
};

export type DictionaryDepartmentPayload = {
  name: string;
  abbreviation: string;
  businessUnit: string;
  description?: string;
  isActive: boolean;
};

export type DictionaryPositionPayload = {
  name: string;
  abbreviation: string;
  businessUnit: string;
  department: string;
  description?: string;
  isActive: boolean;
};

export type DictionaryDocumentTypePayload = {
  name: string;
  shortCode: string;
  currentSequence: number;
  description?: string;
  isActive: boolean;
};

export type DictionaryDocumentSubTypePayload = {
  name: string;
  documentTypeId: string;
  description?: string;
  reviewRequirement?: "NONE" | "SINGLE" | "MULTIPLE";
  isActive: boolean;
};

export type DictionaryStorageLocationPayload = {
  name: string;
  description?: string;
  isActive: boolean;
};

export type DictionaryRetentionPolicyPayload = {
  name: string;
  description?: string;
  retentionDays?: number | null;
  isActive: boolean;
};

const mapBusinessUnit = (item: ApiBusinessUnit): BusinessUnitItem => ({
  id: item.id,
  name: item.name,
  abbreviation: item.abbreviation,
  description: item.description ?? "",
  isActive: item.isActive,
  createdDate: item.createdDate,
  modifiedDate: item.modifiedDate,
});

const mapDepartment = (item: ApiDepartment): DepartmentItem => ({
  id: item.id,
  name: item.name,
  abbreviation: item.abbreviation,
  businessUnit: item.businessUnit as DepartmentItem['businessUnit'],
  description: item.description ?? "",
  isActive: item.isActive,
  createdDate: item.createdDate,
  modifiedDate: item.modifiedDate,
});

const mapPosition = (item: ApiPosition): PositionItem => ({
  id: item.id,
  name: item.name,
  abbreviation: item.abbreviation,
  businessUnit: item.businessUnit as PositionItem['businessUnit'],
  department: item.department,
  description: item.description ?? "",
  isActive: item.isActive,
  createdDate: item.createdDate,
  modifiedDate: item.modifiedDate,
});

const mapDocumentType = (item: ApiDocumentType): DocumentTypeItem => ({
  id: item.id,
  name: item.name,
  description: item.description ?? "",
  shortCode: item.shortCode,
  currentSequence: item.currentSequence,
  lastIssuedDocumentNumber: item.lastIssuedDocumentNumber ?? null,
  nextDocumentNumber: item.nextDocumentNumber ?? null,
  isActive: item.isActive,
  createdDate: item.createdDate,
  modifiedDate: item.modifiedDate,
});

const mapDocumentSubType = (item: ApiDocumentSubType): DocumentSubTypeItem => ({
  id: item.id,
  name: item.name,
  documentTypeId: item.documentTypeId,
  documentType: item.documentType,
  description: item.description ?? "",
  reviewRequirement: item.reviewRequirement ?? "SINGLE",
  isActive: item.isActive,
  createdDate: item.createdDate,
  modifiedDate: item.modifiedDate,
});

const mapStorageLocation = (item: ApiStorageLocation): StorageLocationItem => ({
  id: item.id,
  name: item.name,
  description: item.description ?? "",
  isActive: item.isActive,
  createdDate: item.createdDate,
  modifiedDate: item.modifiedDate,
});

const mapRetentionPolicy = (item: ApiRetentionPolicy): RetentionPolicyItem => ({
  id: item.id,
  name: item.name,
  description: item.description ?? "",
  retentionDays: item.retentionDays ?? null,
  isActive: item.isActive,
  createdDate: item.createdDate,
  modifiedDate: item.modifiedDate,
});

const pendingBusinessUnitsRequests = new Map<string, Promise<BusinessUnitItem[]>>();
const pendingDepartmentsRequests = new Map<string, Promise<DepartmentItem[]>>();
const pendingPositionsRequests = new Map<string, Promise<PositionItem[]>>();
const pendingDocumentTypesRequests = new Map<string, Promise<DocumentTypeItem[]>>();
const pendingDocumentSubTypesRequests = new Map<string, Promise<DocumentSubTypeItem[]>>();
const pendingStorageLocationsRequests = new Map<string, Promise<StorageLocationItem[]>>();
const pendingRetentionPoliciesRequests = new Map<string, Promise<RetentionPolicyItem[]>>();
const pendingLanguagesRequests = new Map<string, Promise<{ label: string; value: string }[]>>();

export const dictionaryApi = {
  getBusinessUnitsPage: async (params: DictionaryListParams): Promise<PageResponse<BusinessUnitItem>> => {
    const response = await api.get<PageResponse<ApiBusinessUnit>>('/settings/dictionaries/business-units/page', { params });
    return {
      data: response.data.data.map(mapBusinessUnit),
      pagination: response.data.pagination,
    };
  },

  getBusinessUnits: async (): Promise<BusinessUnitItem[]> => {
    const cacheKey = 'default';
    const cachedRequest = pendingBusinessUnitsRequests.get(cacheKey);
    if (cachedRequest) {
      return cachedRequest;
    }
    const request = api.get<ApiBusinessUnit[]>('/settings/dictionaries/business-units')
      .then((response) => response.data.map(mapBusinessUnit))
      .finally(() => {
        pendingBusinessUnitsRequests.delete(cacheKey);
      });
    pendingBusinessUnitsRequests.set(cacheKey, request);
    return request;
  },

  createBusinessUnit: async (payload: DictionaryBusinessUnitPayload): Promise<BusinessUnitItem> => {
    const response = await api.post<ApiBusinessUnit>('/settings/dictionaries/business-units', payload);
    return mapBusinessUnit(response.data);
  },

  updateBusinessUnit: async (id: string, payload: Partial<DictionaryBusinessUnitPayload>): Promise<BusinessUnitItem> => {
    const response = await api.put<ApiBusinessUnit>(`/settings/dictionaries/business-units/${id}`, payload);
    return mapBusinessUnit(response.data);
  },

  deleteBusinessUnit: async (id: string): Promise<void> => {
    await api.delete(`/settings/dictionaries/business-units/${id}`);
  },

  getDepartments: async (): Promise<DepartmentItem[]> => {
    const cacheKey = 'default';
    const cachedRequest = pendingDepartmentsRequests.get(cacheKey);
    if (cachedRequest) {
      return cachedRequest;
    }
    const request = api.get<ApiDepartment[]>('/settings/dictionaries/departments')
      .then((response) => response.data.map(mapDepartment))
      .finally(() => {
        pendingDepartmentsRequests.delete(cacheKey);
      });
    pendingDepartmentsRequests.set(cacheKey, request);
    return request;
  },

  getDepartmentsPage: async (params: DepartmentDictionaryListParams): Promise<PageResponse<DepartmentItem>> => {
    const response = await api.get<PageResponse<ApiDepartment>>('/settings/dictionaries/departments/page', { params });
    return {
      data: response.data.data.map(mapDepartment),
      pagination: response.data.pagination,
    };
  },

  createDepartment: async (payload: DictionaryDepartmentPayload): Promise<DepartmentItem> => {
    const response = await api.post<ApiDepartment>('/settings/dictionaries/departments', payload);
    return mapDepartment(response.data);
  },

  updateDepartment: async (id: string, payload: Partial<DictionaryDepartmentPayload>): Promise<DepartmentItem> => {
    const response = await api.put<ApiDepartment>(`/settings/dictionaries/departments/${id}`, payload);
    return mapDepartment(response.data);
  },

  deleteDepartment: async (id: string): Promise<void> => {
    await api.delete(`/settings/dictionaries/departments/${id}`);
  },

  getPositions: async (): Promise<PositionItem[]> => {
    const cacheKey = 'default';
    const cachedRequest = pendingPositionsRequests.get(cacheKey);
    if (cachedRequest) {
      return cachedRequest;
    }
    const request = api.get<ApiPosition[]>('/settings/dictionaries/positions')
      .then((response) => response.data.map(mapPosition))
      .finally(() => {
        pendingPositionsRequests.delete(cacheKey);
      });
    pendingPositionsRequests.set(cacheKey, request);
    return request;
  },

  getPositionsPage: async (params: PositionDictionaryListParams): Promise<PageResponse<PositionItem>> => {
    const response = await api.get<PageResponse<ApiPosition>>('/settings/dictionaries/positions/page', { params });
    return {
      data: response.data.data.map(mapPosition),
      pagination: response.data.pagination,
    };
  },

  createPosition: async (payload: DictionaryPositionPayload): Promise<PositionItem> => {
    const response = await api.post<ApiPosition>('/settings/dictionaries/positions', payload);
    return mapPosition(response.data);
  },

  updatePosition: async (id: string, payload: Partial<DictionaryPositionPayload>): Promise<PositionItem> => {
    const response = await api.put<ApiPosition>(`/settings/dictionaries/positions/${id}`, payload);
    return mapPosition(response.data);
  },

  deletePosition: async (id: string): Promise<void> => {
    await api.delete(`/settings/dictionaries/positions/${id}`);
  },

  getDocumentTypes: async (): Promise<DocumentTypeItem[]> => {
    const cacheKey = 'default';
    const cachedRequest = pendingDocumentTypesRequests.get(cacheKey);
    if (cachedRequest) {
      return cachedRequest;
    }
    const request = api.get<ApiDocumentType[]>('/settings/dictionaries/document-types')
      .then((response) => response.data.map(mapDocumentType))
      .finally(() => {
        pendingDocumentTypesRequests.delete(cacheKey);
      });
    pendingDocumentTypesRequests.set(cacheKey, request);
    return request;
  },

  getSubTypes: async (): Promise<DocumentSubTypeItem[]> => {
    const cacheKey = 'default';
    const cachedRequest = pendingDocumentSubTypesRequests.get(cacheKey);
    if (cachedRequest) {
      return cachedRequest;
    }
    const request = api.get<ApiDocumentSubType[]>('/settings/dictionaries/sub-types')
      .then((response) => response.data.map(mapDocumentSubType))
      .finally(() => {
        pendingDocumentSubTypesRequests.delete(cacheKey);
      });
    pendingDocumentSubTypesRequests.set(cacheKey, request);
    return request;
  },

  getSubTypesPage: async (params: DocumentSubTypeDictionaryListParams): Promise<PageResponse<DocumentSubTypeItem>> => {
    const response = await api.get<PageResponse<ApiDocumentSubType>>('/settings/dictionaries/sub-types/page', { params });
    return {
      data: response.data.data.map(mapDocumentSubType),
      pagination: response.data.pagination,
    };
  },

  createSubType: async (payload: DictionaryDocumentSubTypePayload): Promise<DocumentSubTypeItem> => {
    const response = await api.post<ApiDocumentSubType>('/settings/dictionaries/sub-types', payload);
    return mapDocumentSubType(response.data);
  },

  updateSubType: async (id: string, payload: DictionaryDocumentSubTypePayload): Promise<DocumentSubTypeItem> => {
    const response = await api.put<ApiDocumentSubType>(`/settings/dictionaries/sub-types/${id}`, payload);
    return mapDocumentSubType(response.data);
  },

  deleteSubType: async (id: string): Promise<void> => {
    await api.delete(`/settings/dictionaries/sub-types/${id}`);
  },

  getDocumentTypesPage: async (params: DictionaryListParams): Promise<PageResponse<DocumentTypeItem>> => {
    const response = await api.get<PageResponse<ApiDocumentType>>('/settings/dictionaries/document-types/page', { params });
    return {
      data: response.data.data.map(mapDocumentType),
      pagination: response.data.pagination,
    };
  },

  createDocumentType: async (payload: DictionaryDocumentTypePayload): Promise<DocumentTypeItem> => {
    const response = await api.post<ApiDocumentType>('/settings/dictionaries/document-types', payload);
    return mapDocumentType(response.data);
  },

  updateDocumentType: async (id: string, payload: Partial<DictionaryDocumentTypePayload>): Promise<DocumentTypeItem> => {
    const response = await api.put<ApiDocumentType>(`/settings/dictionaries/document-types/${id}`, payload);
    return mapDocumentType(response.data);
  },

  deleteDocumentType: async (id: string): Promise<void> => {
    await api.delete(`/settings/dictionaries/document-types/${id}`);
  },

  getStorageLocations: async (): Promise<StorageLocationItem[]> => {
    const cacheKey = 'default';
    const cachedRequest = pendingStorageLocationsRequests.get(cacheKey);
    if (cachedRequest) {
      return cachedRequest;
    }
    const request = api.get<ApiStorageLocation[]>('/settings/dictionaries/storage-locations')
      .then((response) => response.data.map(mapStorageLocation))
      .finally(() => {
        pendingStorageLocationsRequests.delete(cacheKey);
      });
    pendingStorageLocationsRequests.set(cacheKey, request);
    return request;
  },

  getStorageLocationsPage: async (params: DictionaryListParams): Promise<PageResponse<StorageLocationItem>> => {
    const response = await api.get<PageResponse<ApiStorageLocation>>('/settings/dictionaries/storage-locations/page', { params });
    return {
      data: response.data.data.map(mapStorageLocation),
      pagination: response.data.pagination,
    };
  },

  createStorageLocation: async (payload: DictionaryStorageLocationPayload): Promise<StorageLocationItem> => {
    const response = await api.post<ApiStorageLocation>('/settings/dictionaries/storage-locations', payload);
    return mapStorageLocation(response.data);
  },

  updateStorageLocation: async (id: string, payload: DictionaryStorageLocationPayload): Promise<StorageLocationItem> => {
    const response = await api.put<ApiStorageLocation>(`/settings/dictionaries/storage-locations/${id}`, payload);
    return mapStorageLocation(response.data);
  },

  deleteStorageLocation: async (id: string): Promise<void> => {
    await api.delete(`/settings/dictionaries/storage-locations/${id}`);
  },

  getRetentionPolicies: async (): Promise<RetentionPolicyItem[]> => {
    const cacheKey = 'default';
    const cachedRequest = pendingRetentionPoliciesRequests.get(cacheKey);
    if (cachedRequest) {
      return cachedRequest;
    }
    const request = api.get<ApiRetentionPolicy[]>('/settings/dictionaries/retention-policies')
      .then((response) => response.data.map(mapRetentionPolicy))
      .finally(() => {
        pendingRetentionPoliciesRequests.delete(cacheKey);
      });
    pendingRetentionPoliciesRequests.set(cacheKey, request);
    return request;
  },

  getLanguages: async (): Promise<{ label: string; value: string }[]> => {
    const cacheKey = 'default';
    const cachedRequest = pendingLanguagesRequests.get(cacheKey);
    if (cachedRequest) {
      return cachedRequest;
    }
    const request = api.get<ApiLanguage[]>('/settings/dictionaries/languages')
      .then((response) => response.data.map((item) => ({
        label: item.label || item.name,
        value: item.value || item.name,
      })))
      .finally(() => {
        pendingLanguagesRequests.delete(cacheKey);
      });
    pendingLanguagesRequests.set(cacheKey, request);
    return request;
  },

  getRetentionPoliciesPage: async (params: DictionaryListParams): Promise<PageResponse<RetentionPolicyItem>> => {
    const response = await api.get<PageResponse<ApiRetentionPolicy>>('/settings/dictionaries/retention-policies/page', { params });
    return {
      data: response.data.data.map(mapRetentionPolicy),
      pagination: response.data.pagination,
    };
  },

  createRetentionPolicy: async (payload: DictionaryRetentionPolicyPayload): Promise<RetentionPolicyItem> => {
    const response = await api.post<ApiRetentionPolicy>('/settings/dictionaries/retention-policies', payload);
    return mapRetentionPolicy(response.data);
  },

  updateRetentionPolicy: async (id: string, payload: DictionaryRetentionPolicyPayload): Promise<RetentionPolicyItem> => {
    const response = await api.put<ApiRetentionPolicy>(`/settings/dictionaries/retention-policies/${id}`, payload);
    return mapRetentionPolicy(response.data);
  },

  deleteRetentionPolicy: async (id: string): Promise<void> => {
    await api.delete(`/settings/dictionaries/retention-policies/${id}`);
  },
};
