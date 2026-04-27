from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

# Custom views
from utils.csrf_views import verify_csrf

urlpatterns = [
    path("admin/", admin.site.urls),
    # API endpoints
    path("api/auth/", include("apps.users.urls")),
    path("api/chat/", include("apps.chat.urls")),
    path("api/documents/", include("apps.documents.urls")),
    path("api/admin-panel/", include("apps.analytics.urls")),
    # Security endpoints
    path("api/security/csrf/verify/", verify_csrf, name="csrf-verify"),
    # API documentation
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path(
        "api/docs/",
        SpectacularSwaggerView.as_view(url_name="schema"),
        name="swagger-ui",
    ),
    # Health check
    path("api/health/", include("apps.rag.health_urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    try:
        import debug_toolbar
        if "debug_toolbar" in settings.INSTALLED_APPS:
            urlpatterns += [path("__debug__/", include(debug_toolbar.urls))]
    except ImportError:
        pass
