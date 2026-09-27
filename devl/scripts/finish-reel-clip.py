#!/usr/bin/env python3
"""
AI 로 생성한 릴스 클립 한 개를 게시 가능한 상태로 다듬는다.

  - 앞뒤 공백 잘라내기
  - 생성 도구 워터마크(제미나이 별 등) 지우기
  - 1080x1920 으로 맞추기
  - 한글 자막 얹기

Veo/Kling 결과물은 대사 앞뒤로 무음이 길고, 오른쪽 아래에 생성 도구
워터마크가 박혀 있다. 자막은 도구에게 맡기면 한글이 깨지므로 여기서 그린다.

사용:
  python3 scripts/finish-reel-clip.py \
      --in "data/clip1.mp4" --out out/clips/01_hook.mp4 \
      --trim 0.4 8.5 \
      --logo 580 1098 88 88 \
      --sub 0.1 2.95 "참기름도 가짜가 있다는 거|알고 계셨나요?" \
      --sub 3.85 8.0 "마트에서 뒷면 세 줄만 보면|바로 구별할 수 있어요"

--sub 의 '|' 는 줄바꿈이다. 시간은 '잘라낸 뒤' 기준.
"""
import argparse, importlib.util, os, subprocess, sys, tempfile, shutil
from PIL import Image, ImageChops, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('gen', os.path.join(HERE, 'gen-insta-cards.py'))
gen = importlib.util.module_from_spec(spec)
sys.modules['gen'] = gen
spec.loader.exec_module(gen)

VW, VH = 1080, 1920
SUB_BOTTOM = 440        # 자막 블록 아래 여백. 인스타 UI 가 하단을 가린다.


def subtitle_png(text, path):
    """자막 한 장. 투명 배경에 흰 글씨 + 검은 테두리 — 어떤 화면에서도 읽힌다."""
    img = Image.new('RGBA', (VW, VH), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    lines = [t.strip() for t in text.split('|') if t.strip()]

    # 쇼츠 자막은 한 덩어리가 짧아서 크게 넣어야 눈에 박힌다.
    size = 104
    while size > 34:
        f = gen.font(size)
        if max(d.textlength(t, font=f) for t in lines) <= VW - 140:
            break
        size -= 2
    lh = int(size * 1.32)

    # 글자 위치를 먼저 정하고 마스크도 같이 만든다(작은 구멍 메우기에 쓴다).
    mask = Image.new('L', (VW, VH), 0)
    md = ImageDraw.Draw(mask)
    placed = []
    y = VH - SUB_BOTTOM - len(lines) * lh
    for ln in lines:
        x = (VW - d.textlength(ln, font=f)) / 2
        placed.append((x, y, ln))
        md.text((x, y), ln, font=f, fill=255)
        y += lh

    for x, y, ln in placed:
        d.text((x, y), ln, font=f, fill=(0, 0, 0),
               stroke_width=max(6, size // 8), stroke_fill=(0, 0, 0))
        d.text((x, y), ln, font=f, fill=(255, 255, 255))

    # 'ㅇ' 안쪽 구멍으로 배경이 비쳐 얼룩처럼 보인다. 윤탱체는 획이 두꺼워
    # 구멍이 핀홀만 해서 글자 일부가 아니라 먼지로 읽힌다. 작은 구멍만 메운다.
    # (ㅁ·ㅂ 같은 큰 속공간은 열어 둬야 글자가 뭉개지지 않는다)
    inv = mask.point(lambda v: 0 if v > 127 else 255)
    ImageDraw.floodfill(inv, (0, 0), 0)          # 바깥 배경 제거 → 구멍만 남음
    k = max(3, (int(size * 0.20) // 2) * 2 + 1)  # 이 굵기보다 얇은 구멍은 작은 것
    big = inv.filter(ImageFilter.MinFilter(k)).filter(ImageFilter.MaxFilter(k))
    small = ImageChops.subtract(inv, big)
    img.paste((255, 255, 255, 255), (0, 0), small)
    img.save(path)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--in', dest='src', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--trim', nargs=2, type=float, metavar=('START', 'END'), required=True)
    ap.add_argument('--logo', nargs=4, type=int, metavar=('X', 'Y', 'W', 'H'),
                    help='원본 좌표 기준 워터마크 상자. 생략하면 지우지 않는다')
    ap.add_argument('--sub', nargs=3, action='append', default=[],
                    metavar=('FROM', 'TO', 'TEXT'), help="시간은 잘라낸 뒤 기준. '|' 는 줄바꿈")
    ap.add_argument('--speed', type=float, default=1.0)
    a = ap.parse_args()

    if not os.path.exists(a.src):
        sys.exit(f'❌ 파일 없음: {a.src}')
    tmp = tempfile.mkdtemp(prefix='reelclip_')
    try:
        # delogo 는 원본 좌표 기준이라 확대 전에 적용해야 한다.
        chain = []
        if a.logo:
            x, y, w, h = a.logo
            chain.append(f'delogo=x={x}:y={y}:w={w}:h={h}')
        chain.append(f'scale={VW}:{VH}:flags=lanczos')
        if a.speed != 1.0:
            chain.append(f'setpts=PTS/{a.speed}')

        inputs = ['-ss', str(a.trim[0]), '-to', str(a.trim[1]), '-i', a.src]
        filt = ','.join(chain)
        # 자막은 구간마다 PNG 를 겹친다. enable 로 노출 시간을 지정한다.
        last = '[v0]'
        parts = [f'[0:v]{filt}{last}']
        for i, (t0, t1, text) in enumerate(a.sub):
            p = os.path.join(tmp, f'sub{i}.png')
            subtitle_png(text, p)
            inputs += ['-i', p]
            nxt = f'[v{i+1}]'
            parts.append(
                f"{last}[{i+1}:v]overlay=0:0:enable='between(t,{float(t0)},{float(t1)})'{nxt}")
            last = nxt

        af = f'atempo={a.speed}' if a.speed != 1.0 else 'anull'
        parts.append(f'[0:a]{af}[a]')
        os.makedirs(os.path.dirname(a.out) or '.', exist_ok=True)
        cmd = (['ffmpeg', '-y'] + inputs +
               ['-filter_complex', ';'.join(parts), '-map', last, '-map', '[a]',
                '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p',
                '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', a.out])
        rc = subprocess.run(cmd, capture_output=True, text=True)
        if rc.returncode != 0:
            sys.exit('❌ ffmpeg 실패:\n' + rc.stderr[-1800:])
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

    dur = a.trim[1] - a.trim[0]
    print(f'✅ {a.out}  ({os.path.getsize(a.out)//1024}KB, 약 {dur/a.speed:.1f}초, 자막 {len(a.sub)}개)')


if __name__ == '__main__':
    main()
