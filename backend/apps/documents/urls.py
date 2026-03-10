from django.urls import path

from apps.documents.views import (
    CollectionDetailView,
    CollectionListCreateView,
    DocumentBulkActionView,
    DocumentDetailView,
    DocumentDownloadView,
    DocumentListView,
    DocumentReprocessView,
    DocumentUpdateView,
    DocumentUploadView,
    TagDetailView,
    TagListCreateView,
)

urlpatterns = [
    # Documents
    path("upload/", DocumentUploadView.as_view(), name="document-upload"),
    path("", DocumentListView.as_view(), name="document-list"),
    path("bulk/", DocumentBulkActionView.as_view(), name="document-bulk"),
    path("<uuid:pk>/", DocumentDetailView.as_view(), name="document-detail"),
    path("<uuid:pk>/update/", DocumentUpdateView.as_view(), name="document-update"),
    path("<uuid:pk>/download/", DocumentDownloadView.as_view(), name="document-download"),
    path("<uuid:pk>/reprocess/", DocumentReprocessView.as_view(), name="document-reprocess"),
    # Collections
    path("collections/", CollectionListCreateView.as_view(), name="collection-list"),
    path("collections/<uuid:pk>/", CollectionDetailView.as_view(), name="collection-detail"),
    # Tags
    path("tags/", TagListCreateView.as_view(), name="tag-list"),
    path("tags/<uuid:pk>/", TagDetailView.as_view(), name="tag-detail"),
]
