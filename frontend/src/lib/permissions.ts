import type { CurrentUser, PermissionCode } from '@/types/auth'

export function hasPermission(
  permissions: readonly string[] | undefined,
  permission: PermissionCode,
) {
  return Boolean(permissions?.includes(permission))
}

export function hasAnyPermission(
  permissions: readonly string[] | undefined,
  expectedPermissions: readonly PermissionCode[],
) {
  return expectedPermissions.some((permission) => hasPermission(permissions, permission))
}

export function userHasPermission(user: CurrentUser | null | undefined, permission: PermissionCode) {
  return hasPermission(user?.permissions, permission)
}
