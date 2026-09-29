// Compliance role hierarchy and permission helpers.
// Hierarchy: super_admin(5) > admin(4) > super_manager(3) > manager(2) > dialer(1)

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

// A monitor can only manage roles STRICTLY below their level.
// super_admin → all; admin → super_manager, manager, dialer; super_manager → manager, dialer
export function canMonitor(monitorRole, targetRole) {
  const m = getRoleLevel(monitorRole);
  const t = getRoleLevel(targetRole);
  return m > t;
}

// SuperManagers, Admins, SuperAdmins can monitor (toggle compliance, view cards, assign remedies, close IDs)
export function isComplianceManager(role) {
  return getRoleLevel(role) >= 3; // super_manager and above
}

// Only Admins and SuperAdmins can access Compliance Admin (KB, script approvals, agent chat)
export function isComplianceAdmin(role) {
  return getRoleLevel(role) >= 4; // admin and above
}

// Can the monitor close a compliance ID?
export function canCloseCompliance(monitorRole) {
  return getRoleLevel(monitorRole) >= 3; // super_manager and above
}

// Can the monitor upload/assign remedies?
export function canAssignRemedy(monitorRole) {
  return getRoleLevel(monitorRole) >= 3; // super_manager and above
}