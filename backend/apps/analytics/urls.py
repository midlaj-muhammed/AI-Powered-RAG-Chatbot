from django.urls import path

from apps.analytics.views import (
    DashboardOverviewView,
    QueryAnalyticsView,
    TopDocumentsView,
    UsageTimelineView,
)
from apps.users.views import AdminUserDetailView, AdminUserListView

urlpatterns = [
    path("dashboard/", DashboardOverviewView.as_view(), name="dashboard-overview"),
    path("analytics/queries/", QueryAnalyticsView.as_view(), name="analytics-queries"),
    path("analytics/usage/", UsageTimelineView.as_view(), name="analytics-usage"),
    path("analytics/top-documents/", TopDocumentsView.as_view(), name="analytics-top-docs"),
    path("admin/", AdminUserListView.as_view(), name="admin-users"),
    path("users/<uuid:pk>/", AdminUserDetailView.as_view(), name="admin-user-detail"),
]
