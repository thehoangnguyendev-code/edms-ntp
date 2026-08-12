export interface CourseReviewer {
  id: string;
  fullName: string;
  username?: string;
  position?: string;
  email?: string;
  department?: string;
  order: number;
  status?: "Signed" | "Pending";
  signedAt?: string;
}

export interface CourseApprover {
  id: string;
  fullName: string;
  username?: string;
  position?: string;
  email?: string;
  department?: string;
  order?: number;
  status?: "Signed" | "Pending";
  signedAt?: string;
}
export interface UploadedFile {
  id: string;
  file: File;
  name: string;
  size: number;
  progress: number;
  status: "uploading" | "success" | "error";
}
