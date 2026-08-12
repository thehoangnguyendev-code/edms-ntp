import { EMAIL_VARIABLES } from "../constants";

const VARIABLE_PATTERN = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

export const extractEmailTemplateVariables = (...sources: Array<string | undefined | null>) => {
  const variables = new Set<string>();

  sources.forEach((source) => {
    if (!source) {
      return;
    }

    let match: RegExpExecArray | null;
    VARIABLE_PATTERN.lastIndex = 0;
    while ((match = VARIABLE_PATTERN.exec(source)) !== null) {
      variables.add(match[1]);
    }
  });

  return Array.from(variables);
};

export const buildSampleVariables = (keys: string[]) => {
  const values: Record<string, string> = {};
  keys.forEach((key) => {
    const variable = EMAIL_VARIABLES.find((item) => item.key === key);
    values[key] = variable?.example ?? "";
  });
  return values;
};
