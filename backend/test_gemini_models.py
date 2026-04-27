from google import genai
import os
from dotenv import load_dotenv

load_dotenv()
api_key = os.getenv("GOOGLE_API_KEY")
client = genai.Client(api_key=api_key)

print("Listing models...")
try:
    for model in client.models.list():
        if "embed" in model.name.lower():
            print(f"Name: {model.name}, Supported Methods: {model.supported_generation_methods}")
except Exception as e:
    print(f"Error: {e}")
