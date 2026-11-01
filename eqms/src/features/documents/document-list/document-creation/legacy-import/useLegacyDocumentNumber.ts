import { useEffect, useMemo, useState } from "react";
import { useDebounce } from "@/hooks";
import { documentApi } from "@/services/api/documents";
import type { DocumentFormState, DocumentTypeOption } from "./legacyImportModel";

/** The Document Number typed after the prefix of the Document Type: its format and, as the person types, whether it is free. */
export function useLegacyDocumentNumber(form: DocumentFormState, documentTypeOptions: DocumentTypeOption[], serialNumberDigits: number) {
  const documentNumberSuffixPattern = useMemo(
    () => new RegExp(`^\\d{${serialNumberDigits}}$`),
    [serialNumberDigits],
  );
  const documentNumberSuffixExample = useMemo(
    () => "7".padStart(serialNumberDigits, "0"),
    [serialNumberDigits],
  );
  const isDocumentNumberSuffixFormatValid = (value: string) =>
    documentNumberSuffixPattern.test(value.trim());

  const [numberCheck, setNumberCheck] = useState<{
    checking: boolean;
    available: boolean | null;
    forNumber: string;
  }>({ checking: false, available: null, forNumber: "" });

  const documentNumberPrefix = useMemo(() => {
    const shortCode = documentTypeOptions.find(
      (o) => o.value === form.documentType,
    )?.shortCode;
    return shortCode ? `${shortCode}.` : "";
  }, [documentTypeOptions, form.documentType]);
  const documentNumber = `${documentNumberPrefix}${form.documentNumberSuffix.trim()}`;
  const debouncedDocumentNumber = useDebounce(documentNumber, 400);

  useEffect(() => {
    if (
      !documentNumberPrefix ||
      !form.documentNumberSuffix.trim() ||
      !isDocumentNumberSuffixFormatValid(form.documentNumberSuffix)
    ) {
      setNumberCheck({ checking: false, available: null, forNumber: "" });
      return;
    }
    let alive = true;
    setNumberCheck((prev) => ({ ...prev, checking: true }));
    documentApi
      .checkLegacyDocumentNumberAvailable(debouncedDocumentNumber)
      .then((available) => {
        if (alive)
          setNumberCheck({
            checking: false,
            available,
            forNumber: debouncedDocumentNumber,
          });
      })
      .catch(() => {
        if (alive)
          setNumberCheck({
            checking: false,
            available: null,
            forNumber: debouncedDocumentNumber,
          });
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedDocumentNumber, documentNumberPrefix, serialNumberDigits]);

  const numberStatus =
    numberCheck.forNumber === documentNumber
      ? numberCheck
      : { checking: true, available: null, forNumber: documentNumber };
  const isDuplicateNumber =
    !numberStatus.checking && numberStatus.available === false;

  return {
    documentNumberPrefix,
    documentNumber,
    documentNumberSuffixExample,
    isDocumentNumberSuffixFormatValid,
    numberStatus,
    isDuplicateNumber,
  };
}
