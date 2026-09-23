"""単語と例文を米国英語のニューラル音声（en-US-AvaNeural）で書き出す。"""
import asyncio
import json
import subprocess
import sys
from pathlib import Path

import edge_tts

VOICE = "en-US-AvaNeural"
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "audio"


def load_words():
    raw = subprocess.check_output(
        [
            "node",
            "--input-type=module",
            "-e",
            """
import fs from 'fs';
import vm from 'vm';
const data = fs.readFileSync('data.js','utf8');
const { WORDS } = vm.runInNewContext(data + '\\n({WORDS})');
process.stdout.write(JSON.stringify(WORDS.map((w) => ({
  id: w.id,
  en: w.en,
  exampleEn: w.exampleEn || ''
}))));
""",
        ],
        cwd=ROOT,
    )
    return json.loads(raw)


async def save_one(sem, name, text):
    dest = OUT / name
    if dest.exists() and dest.stat().st_size > 800:
        return "skip"
    async with sem:
        last = None
        for attempt in range(3):
            try:
                comm = edge_tts.Communicate(text, VOICE)
                await comm.save(str(dest))
                if dest.stat().st_size < 800:
                    raise RuntimeError("file too small")
                return "ok"
            except Exception as exc:
                last = exc
                await asyncio.sleep(1.2 * (attempt + 1))
        return f"fail {name}: {last}"


async def main():
    OUT.mkdir(exist_ok=True)
    words = load_words()
    jobs = []
    for word in words:
        jobs.append((f"{word['id']}.mp3", word["en"]))
        if word["exampleEn"]:
            jobs.append((f"{word['id']}-ex.mp3", word["exampleEn"]))
    sem = asyncio.Semaphore(6)
    results = await asyncio.gather(*(save_one(sem, name, text) for name, text in jobs))
    fails = [item for item in results if str(item).startswith("fail")]
    print(
        f"voice={VOICE} jobs={len(jobs)} ok={results.count('ok')} "
        f"skip={results.count('skip')} fail={len(fails)}"
    )
    for item in fails[:30]:
        print(item)
    if fails:
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
