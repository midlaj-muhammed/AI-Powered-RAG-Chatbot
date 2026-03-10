import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status

User = get_user_model()


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def user_data():
    return {
        "email": "test@example.com",
        "first_name": "Test",
        "last_name": "User",
        "password": "TestPass123!",
        "password_confirm": "TestPass123!",
    }


@pytest.fixture
def create_user():
    def _create_user(email="user@example.com", password="TestPass123!", **kwargs):
        return User.objects.create_user(email=email, password=password, **kwargs)
    return _create_user


@pytest.mark.django_db
class TestRegistration:
    def test_register_success(self, api_client, user_data):
        response = api_client.post("/api/auth/register/", user_data, format="json")
        assert response.status_code == status.HTTP_201_CREATED
        assert "tokens" in response.data
        assert "user" in response.data
        assert response.data["user"]["email"] == user_data["email"]

    def test_register_password_mismatch(self, api_client, user_data):
        user_data["password_confirm"] = "WrongPass123!"
        response = api_client.post("/api/auth/register/", user_data, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_register_duplicate_email(self, api_client, user_data, create_user):
        create_user(email=user_data["email"])
        response = api_client.post("/api/auth/register/", user_data, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_register_weak_password(self, api_client, user_data):
        user_data["password"] = "weak"
        user_data["password_confirm"] = "weak"
        response = api_client.post("/api/auth/register/", user_data, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
class TestLogin:
    def test_login_success(self, api_client, create_user):
        create_user(email="login@example.com", password="TestPass123!")
        response = api_client.post(
            "/api/auth/login/",
            {"email": "login@example.com", "password": "TestPass123!"},
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK
        assert "access" in response.data
        assert "refresh" in response.data

    def test_login_invalid_credentials(self, api_client):
        response = api_client.post(
            "/api/auth/login/",
            {"email": "wrong@example.com", "password": "WrongPass123!"},
            format="json",
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
class TestProfile:
    def test_get_profile(self, api_client, create_user):
        user = create_user()
        api_client.force_authenticate(user=user)
        response = api_client.get("/api/auth/me/")
        assert response.status_code == status.HTTP_200_OK
        assert response.data["email"] == user.email

    def test_update_profile(self, api_client, create_user):
        user = create_user()
        api_client.force_authenticate(user=user)
        response = api_client.patch(
            "/api/auth/me/",
            {"first_name": "Updated"},
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK

    def test_profile_unauthenticated(self, api_client):
        response = api_client.get("/api/auth/me/")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
class TestPasswordChange:
    def test_change_password_success(self, api_client, create_user):
        user = create_user(password="OldPass123!")
        api_client.force_authenticate(user=user)
        response = api_client.post(
            "/api/auth/password/change/",
            {"old_password": "OldPass123!", "new_password": "NewPass456!"},
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK

    def test_change_password_wrong_old(self, api_client, create_user):
        user = create_user(password="OldPass123!")
        api_client.force_authenticate(user=user)
        response = api_client.post(
            "/api/auth/password/change/",
            {"old_password": "WrongPass!", "new_password": "NewPass456!"},
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
