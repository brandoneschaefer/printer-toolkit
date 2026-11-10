export function authorizationStatement(orgName: string): string {
  return (
    `I certify that I am authorized to act on behalf of ${orgName}, and that ${orgName} owns or has ` +
    `explicit written authorization to permit security testing of the systems and networks within the ` +
    `scope described below. I authorize PRET to perform non-destructive security assessment of those ` +
    `systems. I understand that scans are limited to targets marked as authorized in this account, and ` +
    `that I may revoke this authorization at any time.`
  );
}
