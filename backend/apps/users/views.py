import logging

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db.models import Count, Q
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView
from google.oauth2 import id_token
from google.auth.transport import requests
from apps.users.permissions import IsAdmin
from apps.users.serializers import (
    AdminUserSerializer,
    CustomTokenObtainPairSerializer,
    PasswordChangeSerializer,
    RegisterSerializer,
    UserSerializer,
    UserUpdateSerializer,
)

User = get_user_model()
logger = logging.getLogger(__name__)


class RegisterView(generics.CreateAPIView):
    """Register a new user account."""

    queryset = User.objects.all()
    permission_classes = (permissions.AllowAny,)
    serializer_class = RegisterSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        # Generate tokens for the new user
        refresh = RefreshToken.for_user(user)
        return Response(
            {
                "user": UserSerializer(user).data,
                "refresh": str(refresh),
                "access": str(refresh.access_token),
            },
            status=status.HTTP_201_CREATED,
        )


class LoginView(TokenObtainPairView):
    """Authenticate user and return JWT tokens."""

    serializer_class = CustomTokenObtainPairSerializer


class LogoutView(APIView):
    """Blacklist refresh token to log out."""

    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request):
        try:
            refresh_token = request.data.get("refresh")
            if not refresh_token:
                return Response(
                    {"detail": "Refresh token is required."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            token = RefreshToken(refresh_token)
            token.blacklist()
            return Response(
                {"detail": "Successfully logged out."},
                status=status.HTTP_200_OK,
            )
        except Exception:
            return Response(
                {"detail": "Invalid token."},
                status=status.HTTP_400_BAD_REQUEST,
            )


class ProfileView(generics.RetrieveUpdateAPIView):
    """Get or update current user's profile."""

    permission_classes = (permissions.IsAuthenticated,)

    def get_serializer_class(self):
        if self.request.method in ("PUT", "PATCH"):
            return UserUpdateSerializer
        return UserSerializer

    def get_object(self):
        return self.request.user


class PasswordChangeView(APIView):
    """Change the current user's password."""

    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request):
        serializer = PasswordChangeSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        request.user.set_password(serializer.validated_data["new_password"])
        request.user.save()
        return Response(
            {"detail": "Password changed successfully."},
            status=status.HTTP_200_OK,
        )


# ---------- Admin User Management ----------


class AdminUserListView(generics.ListAPIView):
    """Admin: List all users with filtering."""

    serializer_class = AdminUserSerializer
    permission_classes = (permissions.IsAuthenticated, IsAdmin)

    def get_queryset(self):
        queryset = (
            User.objects.all()
            .annotate(
                document_count=Count(
                    "documents", filter=Q(documents__is_deleted=False)
                ),
                session_count=Count(
                    "chat_sessions", filter=Q(chat_sessions__is_archived=False)
                ),
            )
            .order_by("-created_at")
        )

        # Filters
        role = self.request.query_params.get("role")
        if role:
            queryset = queryset.filter(role=role)

        is_active = self.request.query_params.get("is_active")
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == "true")

        search = self.request.query_params.get("search")
        if search:
            queryset = queryset.filter(
                Q(email__icontains=search)
                | Q(first_name__icontains=search)
                | Q(last_name__icontains=search)
            )

        return queryset


class AdminUserDetailView(APIView):
    """Admin: Update user role or active status."""

    permission_classes = (permissions.IsAuthenticated, IsAdmin)

    def patch(self, request, pk):
        try:
            user = User.objects.get(id=pk)
        except User.DoesNotExist:
            return Response(
                {"detail": "User not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Prevent self-demotion
        if user == request.user and "role" in request.data:
            return Response(
                {"detail": "You cannot change your own role."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if "role" in request.data:
            role = request.data["role"]
            if role not in ["admin", "editor", "viewer"]:
                return Response(
                    {"detail": "Invalid role."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            user.role = role

        if "is_active" in request.data:
            if user == request.user:
                return Response(
                    {"detail": "You cannot deactivate yourself."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            user.is_active = request.data["is_active"]

        user.save()
        return Response(AdminUserSerializer(user).data)

# Google Login View
class GoogleLoginView(APIView):
    permission_classes = (permissions.AllowAny,)

    def post(self, request):
        token = request.data.get("token")
        if not token:
            return Response(
                {"error": "Token is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        client_id = getattr(settings, "GOOGLE_OAUTH_CLIENT_ID", "")
        if not client_id:
            logger.error("Google OAuth client ID is not configured")
            return Response(
                {"error": "Google Sign-In is not configured on the server."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        try:
            # Verify the token with Google
            idinfo = id_token.verify_oauth2_token(
                token, requests.Request(), client_id
            )

            # Get user info from verified token
            email = idinfo.get("email")
            if not email:
                return Response(
                    {"error": "Invalid token: missing email claim"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            first_name = idinfo.get("given_name", "")
            last_name = idinfo.get("family_name", "")

            # Create or get user
            user, created = User.objects.get_or_create(
                email=email,
                defaults={
                    "first_name": first_name,
                    "last_name": last_name,
                    "role": "editor",  # Default role
                },
            )

            # Generate JWT for our app
            refresh = RefreshToken.for_user(user)

            return Response(
                {
                    "access": str(refresh.access_token),
                    "refresh": str(refresh),
                    "user": UserSerializer(user).data,
                }
            )
        except ValueError as e:
            return Response(
                {"error": f"Invalid token: {str(e)}"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception:
            logger.exception("Unexpected error during Google Sign-In")
            return Response(
                {"error": "An unexpected error occurred during Google Sign-In."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )