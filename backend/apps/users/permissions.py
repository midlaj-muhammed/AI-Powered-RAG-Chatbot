from rest_framework import permissions

from apps.users.models import UserRole


class IsAdmin(permissions.BasePermission):
    """Allow access only to admin users."""

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role == UserRole.ADMIN
        )


class IsEditorOrAdmin(permissions.BasePermission):
    """Allow access to editor and admin users."""

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role in (UserRole.ADMIN, UserRole.EDITOR)
        )


class IsOwnerOrAdmin(permissions.BasePermission):
    """Allow access only to the owner of the object or admin."""

    def has_object_permission(self, request, view, obj):
        if request.user.role == UserRole.ADMIN:
            return True
        # Check common owner-field names
        if hasattr(obj, "user"):
            return obj.user == request.user
        if hasattr(obj, "uploaded_by"):
            return obj.uploaded_by == request.user
        return False
