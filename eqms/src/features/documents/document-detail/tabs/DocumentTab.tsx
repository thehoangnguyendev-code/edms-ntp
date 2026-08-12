import React, { useEffect, useState } from "react";
import { DocumentPdfViewer } from "@/features/documents/shared/components/DocumentPdfViewer";
import { Loading } from "@/components/ui/loading/Loading";

interface DocumentTabProps {
    documentFile?: File | null;
    documentType?: 'pdf' | 'docx' | 'image';
}

export const DocumentTab: React.FC<DocumentTabProps> = ({ 
    documentFile = null,
    documentType
}) => {
    const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);

    // Create object URL only for PDF preview and clean it up on changes
    useEffect(() => {
        if (!documentFile) {
            setPdfPreviewUrl(null);
            return;
        }

        const name = documentFile.name.toLowerCase();
        const type = documentFile.type.toLowerCase();
        const isPdf = documentType
            ? documentType === "pdf"
            : name.endsWith(".pdf") || type === "application/pdf";

        if (!isPdf) {
            setPdfPreviewUrl(null);
            return;
        }

        const url = URL.createObjectURL(documentFile);
        setPdfPreviewUrl(url);

        return () => {
            URL.revokeObjectURL(url);
        };
    }, [documentFile, documentType]);

    if (pdfPreviewUrl) {
        return <DocumentPdfViewer fileUrl={pdfPreviewUrl} />;
    }

    const previewHint = documentFile
        ? "Preview is being prepared or the selected file type is not a PDF yet."
        : "No PDF preview is available yet.";

    return (
        <div
            className="flex min-h-[420px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 select-none"
            onContextMenu={(e) => e.preventDefault()}
        >
            <div className="flex max-w-md flex-col items-center gap-3 text-center">
                {documentFile && <Loading size="default" text="Loading PDF preview..." />}
                <p className="text-sm text-slate-600">{previewHint}</p>
            </div>
        </div>
    );
};
