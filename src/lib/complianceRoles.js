// Frontend role helpers — mirrors base44/shared/complianceRoles.ts
export const ROLE_LEVELS = {
  super_admin: 5,
  admin: 4,
  super_manager: 3,
  manager: 2,
  dialer: 1,
};

export function getRoleLevel(role) {
  return ROLE_LEVELS[role] || 0;
}

export function canMonitor(monitorRole, targetRole) {
  return getRoleLevel(monitorRole) > getRoleLevel(targetRole);
}

export function isComplianceManager(role) {
  return getRoleLevel(role) >= 3;
}

export function isComplianceAdmin(role) {
  return getRoleLevel(role) >= 4;
}

export function canCloseCompliance(role) {
  return getRoleLevel(role) >= 3;
}

export function canAssignRemedy(role) {
  return getRoleLevel(role) >= 3;
}