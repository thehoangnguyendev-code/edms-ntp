import React, { useMemo } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { FileText, Link as LinkIcon, Download, Video, FileImage } from "lucide-react";
import { StatusBadge } from "@/components/ui/badge/Badge";
import { formatFileSize } from "@/utils/format";
import { cn } from "@/components/ui/utils";
import { useNavigateWithLoading } from "@/hooks";
import { ROUTES } from "@/app/routes.constants";
import { FullPageLoading } from "@/components/ui/loading/Loading";
import { TableMarkup, TABLE_STYLES } from "@/components/ui/table/TablePrimitives";

interface TrainingFile {
  id: string;
  name: string;
  size: number;
  type: string;
  status: "uploading" | "success" | "error";
}

interface ExpandedCourseRowProps {
  item: {
    id: string;
    trainingFiles?: TrainingFile[];
    materials?: any[];
    linkedDocumentId?: string;
    linkedDocumentTitle?: string;
  };
  isExpanded: boolean;
  visibleColumnsLength: number;
}

/**
 * Reusable expanded row component for displaying training materials and linked documents
 * Follows the UI pattern of ExpandedDocumentRow
 */
export const ExpandedCourseRow: React.FC<ExpandedCourseRowProps> = ({
  item,
  isExpanded,
  visibleColumnsLength,
}) => {
  const { navigateTo, isNavigating } = useNavigateWithLoading();
  const shouldReduceMotion = useReducedMotion();
  const transitionConfig = useMemo(() => shouldReduceMotion ? { duration: 0 } : { type: "spring" as const, stiffness: 90, damping: 16 }, [shouldReduceMotion]);
  const files = item.trainingFiles || [];
  const hasLinkedDoc = !!item.linkedDocumentId;
  const hasContent = files.length > 0 || hasLinkedDoc;

  if (!hasContent) return null;

  return (
    <AnimatePresence initial={false}>
      {isExpanded && (
        <motion.tr
          key={`expanded-${item.id}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={transitionConfig}
          className="bg-slate-50/50"
        >
          <TableMarkup.Cell colSpan={visibleColumnsLength - 1} className="p-0 border-b border-slate-200">
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={transitionConfig}
              className="overflow-hidden"
            >
              <div className="px-4 py-3">
                <div className="ml-9 flex flex-wrap gap-6">
                  {/* Training Materials Table */}
                  {files.length > 0 && (
                    <div>
                      <p className="text-2xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                        Training Materials ({files.length})
                      </p>
                      <div className="rounded-lg border border-slate-200 overflow-hidden bg-white shadow-sm inline-block">
                        <TableMarkup.Root className="text-xs table-auto">
                          <TableMarkup.Head>
                            <TableMarkup.Row className="bg-slate-100 border-b border-slate-200">
                              <TableMarkup.HeaderCell className="py-1.5 px-2.5 text-left font-semibold text-slate-600 whitespace-nowrap">Material Number</TableMarkup.HeaderCell>
                              <TableMarkup.HeaderCell className="py-1.5 px-2.5 text-left font-semibold text-slate-600 whitespace-nowrap">Material Name</TableMarkup.HeaderCell>
                              <TableMarkup.HeaderCell className="py-1.5 px-2.5 text-left font-semibold text-slate-600 whitespace-nowrap">Type</TableMarkup.HeaderCell>
                              <TableMarkup.HeaderCell className="py-1.5 px-2.5 text-left font-semibold text-slate-600 whitespace-nowrap">Size</TableMarkup.HeaderCell>
                              <TableMarkup.HeaderCell className={TABLE_STYLES.table6}>Status</TableMarkup.HeaderCell>
                              <TableMarkup.HeaderCell className={TABLE_STYLES.table6}>Action</TableMarkup.HeaderCell>
                            </TableMarkup.Row>
                          </TableMarkup.Head>
                          <TableMarkup.Body className="divide-y divide-slate-100">
                            {files.map((file) => {
                              const extension = file.name.split('.').pop()?.toUpperCase() || 'FILE';
                              const isVideo = ['MP4', 'MOV', 'AVI'].includes(extension);
                              const isPDF = extension === 'PDF';
                              const isImage = ['JPG', 'PNG', 'GIF'].includes(extension);

                              return (
                                <TableMarkup.Row key={file.id} className="hover:bg-slate-50 transition-colors">
                                  <TableMarkup.Cell 
                                    className={TABLE_STYLES.table5}
                                    onClick={() => navigateTo(ROUTES.TRAINING.COURSE_DETAIL(item.id))}
                                  >
                                    {file.id.toUpperCase()}
                                  </TableMarkup.Cell>
                                  <TableMarkup.Cell className="py-1.5 px-2.5 whitespace-nowrap">
                                    <p className="font-medium text-slate-900">{file.name}</p>
                                    <p className="text-2xs text-slate-500">Training document version</p>
                                  </TableMarkup.Cell>
                                  <TableMarkup.Cell className="py-1.5 px-2.5 whitespace-nowrap">
                                    <div className="flex items-center gap-2">
                                      {isVideo ? <Video className="h-3.5 w-3.5 text-purple-600" /> :
                                        isPDF ? <FileText className="h-3.5 w-3.5 text-red-600" /> :
                                          isImage ? <FileImage className="h-3.5 w-3.5 text-blue-600" /> :
                                            <FileText className="h-3.5 w-3.5 text-slate-600" />}
                                      <span className="font-medium text-slate-700">{isVideo ? 'Video' : isPDF ? 'PDF' : isImage ? 'Image' : 'Document'}</span>
                                    </div>
                                  </TableMarkup.Cell>
                                  <TableMarkup.Cell className="py-1.5 px-2.5 text-slate-500 whitespace-nowrap">
                                    {formatFileSize(file.size)}
                                  </TableMarkup.Cell>
                                  <TableMarkup.Cell className="py-1.5 px-2.5 text-center whitespace-nowrap">
                                    <StatusBadge
                                      status={file.status === 'success' ? 'effective' : file.status === 'error' ? 'rejected' : 'pendingReview'}
                                      size="sm"
                                    />
                                  </TableMarkup.Cell>
                                  <TableMarkup.Cell className="py-1.5 px-2.5 text-center whitespace-nowrap">
                                    <button className="p-1 hover:bg-slate-100 rounded text-emerald-600 transition-colors">
                                      <Download className="h-3.5 w-3.5" />
                                    </button>
                                  </TableMarkup.Cell>
                                </TableMarkup.Row>
                              );
                            })}
                          </TableMarkup.Body>
                        </TableMarkup.Root>
                      </div>
                    </div>
                  )}

                  {/* Linked Documents Section */}
                  {hasLinkedDoc && (
                    <div>
                      <p className="text-2xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                        Linked Document
                      </p>
                      <div className="rounded-lg border border-slate-200 p-2.5 bg-white shadow-sm inline-flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
                          <FileText className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-emerald-600 hover:underline cursor-pointer">
                            {item.linkedDocumentId}
                          </p>
                          <p className="text-2xs text-slate-500 max-w-[250px]">
                            {item.linkedDocumentTitle}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </TableMarkup.Cell>
          <TableMarkup.Cell className={TABLE_STYLES.emptyCell1}></TableMarkup.Cell>
        </motion.tr>
      )}
      {isNavigating && <FullPageLoading text="Loading course details..." />}
    </AnimatePresence>
  );
};
