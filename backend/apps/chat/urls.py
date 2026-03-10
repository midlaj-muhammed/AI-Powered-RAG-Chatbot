from django.urls import path

from apps.chat.views import (
    ChatSessionDetailView,
    ChatSessionListCreateView,
    ExportChatView,
    ExportDocumentsView,
    MessageFeedbackView,
    QueryHistoryView,
    SavedSearchDetailView,
    SavedSearchListCreateView,
    SendMessageView,
    ToggleFavoriteView,
)

urlpatterns = [
    path("sessions/", ChatSessionListCreateView.as_view(), name="chat-sessions"),
    path(
        "sessions/<uuid:pk>/",
        ChatSessionDetailView.as_view(),
        name="chat-session-detail",
    ),
    path(
        "sessions/<uuid:session_id>/messages/",
        SendMessageView.as_view(),
        name="chat-send-message",
    ),
    path(
        "messages/<uuid:message_id>/feedback/",
        MessageFeedbackView.as_view(),
        name="message-feedback",
    ),
    path(
        "messages/<uuid:message_id>/favorite/",
        ToggleFavoriteView.as_view(),
        name="message-favorite",
    ),
    # Phase 3
    path("history/", QueryHistoryView.as_view(), name="query-history"),
    path("saved-searches/", SavedSearchListCreateView.as_view(), name="saved-searches"),
    path(
        "saved-searches/<uuid:pk>/",
        SavedSearchDetailView.as_view(),
        name="saved-search-detail",
    ),
    path(
        "export/session/<uuid:session_id>/",
        ExportChatView.as_view(),
        name="export-chat",
    ),
    path("export/documents/", ExportDocumentsView.as_view(), name="export-documents"),
]
