from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()  # loads OPENAI_API_KEY from .env for local dev

client = OpenAI()

LANGUAGE_INSTRUCTIONS = """
You are generating a fictional animal language for a lo-fi jungle website.

Language rules:
- Allowed characters: a e i o u k g t r l m n s h ' -
- Common pattern: hyphenated compounds like "gra-tok"
- Word length: 1-3 syllables, syllables are CV or CVC
- Phrase length: 2-6 words
- Word order: Verb-Subject-Object (VSO)
- Suffixes:
  -tok = command/urgent
  -na = question
  -ku = warning
  -mii = friendly/affection
Return JSON only.
"""

USER_TASK = """
Generate 16 phrases for these intents (in order):
1 Greeting
2 I am here
3 Who are you?
4 Predator nearby
5 Storm coming
6 I am hungry
7 Food found
8 Come closer
9 Go away
10 Follow me
11 I am hurt
12 Safe place
13 Night is coming
14 Play with me
15 My territory
16 Farewell
"""

schema = {
    "type": "object",
    "properties": {
        "phrases": {
            "type": "array",
            "minItems": 16,
            "maxItems": 16,
            "items": {
                "type": "object",
                "properties": {
                    "id": {"type": "integer"},
                    "intent": {"type": "string"},
                    "animal_text": {"type": "string"},
                    "english_gloss": {"type": "string"},
                    "mood": {"type": "string"}
                },
                "required": ["id", "intent", "animal_text", "english_gloss", "mood"],
                "additionalProperties": False
            }
        }
    },
    "required": ["phrases"],
    "additionalProperties": False
}

response = client.responses.create(
    model="gpt-5.2",
    input=[
        {"role": "system", "content": LANGUAGE_INSTRUCTIONS},
        {"role": "user", "content": USER_TASK},
    ],
    text={
        "format": {
            "type": "json_schema",
            "name": "animal_language_phrases",
            "schema": schema,
            "strict": True
        }
    }
)

print(response.output_text)
