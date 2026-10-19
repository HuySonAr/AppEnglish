"""Builds the Listening course demo pack from content.py (Windows only).

Each line is spoken with a Windows voice (System.Speech: Zira for 'W', David
for 'M'), trimmed of silence and joined with short pauses, so the start and
end of every sentence are known exactly. Writes, next to this file:

  audio/<key>.mp3   the recordings (ffmpeg, 64 kbit/s mono)
  audio/<key>.srt   their timed sentences, for "Import timed file"
  pack.json         everything the seed script needs

Run: python build.py   (needs PowerShell and ffmpeg on PATH)
"""

import json
import os
import random
import shutil
import subprocess
import sys
import tempfile
import wave
from array import array

from content import LEVELS

HERE = os.path.dirname(os.path.abspath(__file__))
AUDIO = os.path.join(HERE, 'audio')
VOICES = {'W': 'Microsoft Zira Desktop', 'M': 'Microsoft David Desktop'}
LABELS = {'W': 'Woman', 'M': 'Man'}
RATE = 22050
LEAD, GAP, TAIL, PAD = 0.4, 0.6, 0.6, 0.05

SPEAK_PS1 = r"""
param([string]$jobs)
Add-Type -AssemblyName System.Speech
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
$fmt = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(22050, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
foreach ($j in (Get-Content $jobs -Raw -Encoding UTF8 | ConvertFrom-Json)) {
  $s.SelectVoice($j.voice)
  $s.Rate = [int]$j.rate
  $s.SetOutputToWaveFile($j.file, $fmt)
  $s.Speak($j.text)
  $s.SetOutputToNull()
}
$s.Dispose()
"""


def recordings():
    """Every recording of the pack: key, title, level, kind, rate and lines."""
    for level in LEVELS:
        name, rate = level['level'], level['rate']
        for n, lesson in enumerate(level['lessons'], 1):
            yield f'{name.lower()}-lesson{n}', lesson, name, rate
        yield f'{name.lower()}-check', level['check'], name, rate
        for n, section in enumerate(level['test']['sections'], 1):
            yield f'{name.lower()}-test{n}', section, name, rate


def voice_of(speaker):
    return speaker.split(':')[0]


def label_of(speaker):
    return '' if speaker.endswith(':talk') else LABELS[speaker]


def trimmed(path):
    """The samples of a WAV file without the silence around the speech."""
    with wave.open(path, 'rb') as source:
        assert source.getframerate() == RATE and source.getsampwidth() == 2 and source.getnchannels() == 1
        samples = array('h', source.readframes(source.getnframes()))
    loud = [i for i, value in enumerate(samples) if abs(value) > 400]
    if not loud:
        return samples
    pad = int(PAD * RATE)
    return samples[max(0, loud[0] - pad):loud[-1] + pad]


def srt_time(seconds):
    ms = int(round(seconds * 1000))
    return f'{ms // 3600000:02}:{ms // 60000 % 60:02}:{ms // 1000 % 60:02},{ms % 1000:03}'


def shuffled(question):
    """The question with its options in a fixed random order."""
    options = [{'text': question['right'], 'isCorrect': True}] + [{'text': text, 'isCorrect': False} for text in question['wrong']]
    random.Random(question['prompt']).shuffle(options)
    return {'skill': question['skill'], 'prompt': question['prompt'], 'options': options, 'explanation': question['explanation']}


def main():
    if not shutil.which('ffmpeg'):
        sys.exit('ffmpeg is not on PATH')
    os.makedirs(AUDIO, exist_ok=True)
    work = tempfile.mkdtemp(prefix='listening-course-')
    try:
        jobs = []
        for key, item, _, rate in recordings():
            for index, (speaker, text) in enumerate(item['lines']):
                jobs.append({'file': os.path.join(work, f'{key}-{index}.wav'), 'voice': VOICES[voice_of(speaker)], 'rate': rate, 'text': text})
        jobs_path = os.path.join(work, 'jobs.json')
        with open(jobs_path, 'w', encoding='utf-8') as out:
            json.dump(jobs, out, ensure_ascii=False)
        script = os.path.join(work, 'speak.ps1')
        with open(script, 'w', encoding='utf-8-sig') as out:
            out.write(SPEAK_PS1)
        print(f'Speaking {len(jobs)} lines…')
        subprocess.run(['powershell', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script, '-jobs', jobs_path], check=True)

        pack = {'topic': 'Listening course (demo)', 'recordings': {}, 'levels': []}
        for key, item, level, _ in recordings():
            samples = array('h', [0] * int(LEAD * RATE))
            segments = []
            for index, (speaker, text) in enumerate(item['lines']):
                if index:
                    samples.extend([0] * int(GAP * RATE))
                start = len(samples) / RATE
                samples.extend(trimmed(os.path.join(work, f'{key}-{index}.wav')))
                segments.append({'speaker': label_of(speaker), 'text': text, 'start': round(start, 2), 'end': round(len(samples) / RATE, 2)})
            samples.extend([0] * int(TAIL * RATE))
            wav_path = os.path.join(work, f'{key}.wav')
            with wave.open(wav_path, 'wb') as target:
                target.setnchannels(1)
                target.setsampwidth(2)
                target.setframerate(RATE)
                target.writeframes(samples.tobytes())
            mp3 = os.path.join(AUDIO, f'{key}.mp3')
            subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', wav_path, '-codec:a', 'libmp3lame', '-b:a', '64k', '-ac', '1', mp3], check=True)
            with open(os.path.join(AUDIO, f'{key}.srt'), 'w', encoding='utf-8') as out:
                for n, segment in enumerate(segments, 1):
                    who = f"{segment['speaker']}: " if segment['speaker'] else ''
                    out.write(f"{n}\n{srt_time(segment['start'])} --> {srt_time(segment['end'])}\n{who}{segment['text']}\n\n")
            pack['recordings'][key] = {'title': f"{level} · {item['title']}", 'level': level, 'kind': item['kind'], 'file': f'audio/{key}.mp3', 'segments': segments}

        for level in LEVELS:
            name = level['level'].lower()
            pack['levels'].append({
                'level': level['level'],
                'unit': {
                    **level['unit'],
                    'lessons': [
                        {
                            'title': lesson['title'],
                            'recording': f'{name}-lesson{n}',
                            'keywords': [{'word': word, 'meaning': meaning} for word, meaning in lesson['keywords']],
                            'gist': shuffled(lesson['gist']),
                            'detail': [shuffled(question) for question in lesson['detail']],
                            'close': lesson['close'],
                        }
                        for n, lesson in enumerate(level['lessons'], 1)
                    ],
                    'check': [{'recording': f'{name}-check', 'questions': [shuffled(question) for question in level['check']['questions']]}],
                },
                'levelTest': {
                    'title': level['test']['title'],
                    'sections': [
                        {'recording': f'{name}-test{n}', 'questions': [shuffled(question) for question in section['questions']]}
                        for n, section in enumerate(level['test']['sections'], 1)
                    ],
                },
                'placement': {'recording': f'{name}-check', 'questions': [shuffled(question) for question in level['check']['placement']]},
            })
        with open(os.path.join(HERE, 'pack.json'), 'w', encoding='utf-8') as out:
            json.dump(pack, out, ensure_ascii=False, indent=1)
        questions = sum(
            len(lesson['detail']) + 1 for level in pack['levels'] for lesson in level['unit']['lessons']
        ) + sum(
            len(level['unit']['check'][0]['questions']) + len(level['placement']['questions']) + sum(len(section['questions']) for section in level['levelTest']['sections'])
            for level in pack['levels']
        )
        print(f"Wrote {len(pack['recordings'])} recordings and {questions} questions.")
    finally:
        shutil.rmtree(work, ignore_errors=True)


if __name__ == '__main__':
    main()
