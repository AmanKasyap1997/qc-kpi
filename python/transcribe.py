from faster_whisper import WhisperModel
import sys
import json

audio_file = sys.argv[1]

model = WhisperModel(
    "base",
    device="cpu",
    compute_type="int8"
)

segments, info = model.transcribe(audio_file)

transcript = ""

for segment in segments:
    transcript += segment.text + " "

print(json.dumps({
    "transcript": transcript.strip()
}))