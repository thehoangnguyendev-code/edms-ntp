/** How a person is named in the Head of Unit and Department Head dropdowns: employee ID first, then the name and the user name. */
export const userOptionLabel = (employeeCode: string | null | undefined, fullName: string, username?: string | null): string =>
  `${employeeCode ? `${employeeCode} - ` : ""}${fullName}${username ? ` (${username})` : ""}`;
