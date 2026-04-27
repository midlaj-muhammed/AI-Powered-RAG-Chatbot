import os
import django
import sys

# Setup Django
sys.path.append('/app')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
django.setup()

from apps.documents.models import Document
from apps.documents.tasks import process_document

def reindex_all():
    docs = Document.objects.filter(is_deleted=False)
    print(f"Found {docs.count()} documents to check/re-index.")
    
    for doc in docs:
        print(f"Re-processing: {doc.original_name} ({doc.id})")
        # Reset status if it's already 'indexed' to force process_document to work
        # (Though process_document usually takes ID and just does the work)
        try:
            process_document(str(doc.id))
            print(f"Successfully started/completed re-indexing for {doc.original_name}")
        except Exception as e:
            print(f"Failed to re-index {doc.original_name}: {e}")

if __name__ == "__main__":
    reindex_all()
