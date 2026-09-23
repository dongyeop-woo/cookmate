#!/usr/bin/env python3
"""
레시피 하나를 인스타 릴스(1080x1920 세로 영상)로 만든다.

사용:
  python3 scripts/gen-insta-reels.py --id 213
  python3 scripts/gen-insta-reels.py --id 213 --sec 1.8

구성: 표지(2.5초) → 스텝별 컷(기본 1.6초) → 마무리(3초)

음악은 넣지 않는다. 외부 음원을 얹으면 저작권에 걸리고, 인스타 앱에서
트렌딩 오디오를 붙이는 쪽이 노출에도 유리하다.
"""
import argparse, importlib.util, os, shutil, subprocess, sys, tempfile
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('gen', os.path.join(HERE, 'gen-insta-cards.py'))
gen = importlib.util.module_from_spec(spec)
sys.modules['gen'] = gen
spec.loader.exec_module(gen)

VW, VH = 1080, 1920          # 릴스 규격
FPS = 30


def _panel(card, d, top, h):
    p = Image.new('RGBA', (VW, h), (255, 255, 255, 245))
    card.paste(p, (0, top), p)


def _mark(card, y=96):
    f = os.path.join(HERE, '..', 'assets', 'brand-mark-white.png')
    if not os.path.exists(f):
        return
    ms = 88
    m = Image.open(f).convert('RGBA').resize((ms, ms), Image.LANCZOS)
    sh = Image.new('RGBA', (ms + 40, ms + 40), (0, 0, 0, 0))
    sh.paste((0, 0, 0, 120), (20, 23), m.getchannel('A'))
    sh = sh.filter(__import__('PIL.ImageFilter', fromlist=['ImageFilter']).GaussianBlur(9))
    card.paste(sh, (VW - 48 - ms - 20, y - ms // 2 - 20), sh)
    card.paste(m, (VW - 48 - ms, y - ms // 2), m)


def frame_cover(r, title):
    """표지 — 사진을 꽉 채우고 아래에 제목."""
    card = Image.new('RGB', (VW, VH), gen.WHITE)
    card.paste(gen.cover_fit(gen.fetch_image(r['image']), VW, VH), (0, 0))
    grad = Image.new('L', (1, VH))
    for y in range(VH):
        t = max(0.0, (y - VH * 0.42) / (VH * 0.58))
        grad.putpixel((0, y), int(185 * (t ** 1.3)))
    card.paste(Image.new('RGB', (VW, VH), (8, 24, 18)), (0, 0), grad.resize((VW, VH)))

    d = ImageDraw.Draw(card)
    _mark(card)
    g = gen.palette_from(gen.fetch_image(r['image']))[0]

    size = 150
    while size > 70:
        f = gen.font(size)
        lines = gen.wrap(d, title, f, VW - 120, prefer_space=True)
        if len(lines) <= 2:
            break
        size -= 4
    lh = int(size * 1.22)
    y = VH - 420 - len(lines) * lh
    for ln in lines:
        d.text((60, y), ln, font=f, fill=gen.WHITE,
               stroke_width=max(6, size // 8), stroke_fill=gen.WHITE)
        d.text((60, y), ln, font=f, fill=(0, 0, 0),
               stroke_width=max(3, size // 15), stroke_fill=(0, 0, 0))
        d.text((60, y), ln, font=f, fill=g[1])
        y += lh
    d.text((60, y + 20), f"#{r['title'].replace(' ', '')}", font=gen.font(56), fill=gen.WHITE)
    d.text((60, VH - 120), '@cookmate_yojalal', font=gen.font(40), fill=(228, 228, 228))
    return card


def frame_step(r, idx, st):
    """스텝 컷 — 사진 위, 설명 아래."""
    card = Image.new('RGB', (VW, VH), gen.WHITE)
    box_h = 560
    top = VH - box_h
    img = st.get('imageUrl') or r.get('image')
    card.paste(gen.cover_fit(gen.fetch_image(img), VW, top), (0, 0))
    _panel(card, None, top, box_h)
    d = ImageDraw.Draw(card)
    _mark(card)

    # 스텝 번호 배지
    bs = 96
    ImageDraw.Draw(card).ellipse([56, top - bs // 2, 56 + bs, top + bs // 2], fill=gen.GREEN)
    d.text((56 + bs / 2, top), str(idx), font=gen.font(56), fill=gen.WHITE, anchor='mm')

    f = gen.hand(52)
    text = gen.condense(st['description'], r.get('ingredients'))
    lines = gen.wrap(d, text, f, VW - 130)[:4]
    y = top + 130
    for ln in lines:
        d.text((64, y), ln, font=f, fill=gen.INK)
        y += 66
    if st.get('time'):
        t = f"{int(st['time'])}분" if st['time'] >= 1 else f"{round(st['time'] * 60)}초"
        d.text((VW - 64, VH - 74), f'⏱ {t}', font=gen.font(46), fill=gen.GREEN_DEEP, anchor='rd')
    return card


def frame_outro(r):
    card = gen.make_outro().resize((VW, VW), Image.LANCZOS)
    out = Image.new('RGB', (VW, VH), gen.WHITE)
    out.paste(card, (0, (VH - VW) // 2))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--id', required=True)
    ap.add_argument('--title', default='', help='표지 문구 (기본: 레시피 제목)')
    ap.add_argument('--sec', type=float, default=1.6, help='스텝당 노출 시간(초)')
    ap.add_argument('--out', default='out/reels')
    a = ap.parse_args()

    db = gen.fetch_recipes()
    if a.id not in db:
        sys.exit(f'❌ 없는 id: {a.id}')
    r = db[a.id]
    title = a.title or r['title']

    tmp = tempfile.mkdtemp(prefix='reels_')
    plan = [(frame_cover(r, title), 2.5)]
    for i, st in enumerate(r.get('steps') or [], 1):
        plan.append((frame_step(r, i, st), a.sec))
    plan.append((frame_outro(r), 3.0))

    # ffmpeg concat 용 목록 — 프레임마다 지속시간을 지정한다
    listing = []
    for i, (im, sec) in enumerate(plan):
        p = os.path.join(tmp, f'{i:03d}.png')
        im.save(p)
        listing.append(f"file '{p}'\nduration {sec}")
    listing.append(f"file '{os.path.join(tmp, f'{len(plan)-1:03d}.png')}'")   # 마지막 프레임 고정용
    lst = os.path.join(tmp, 'list.txt')
    open(lst, 'w').write('\n'.join(listing) + '\n')

    os.makedirs(a.out, exist_ok=True)
    dst = os.path.join(a.out, f"{r['id']}_{r['title'].replace(' ', '')}.mp4")
    cmd = ['ffmpeg', '-y', '-f', 'concat', '-safe', '0', '-i', lst,
           '-vf', f'fps={FPS},format=yuv420p', '-c:v', 'libx264', '-preset', 'medium',
           '-crf', '20', '-movflags', '+faststart', dst]
    res = subprocess.run(cmd, capture_output=True, text=True)
    shutil.rmtree(tmp, ignore_errors=True)
    if res.returncode != 0:
        sys.exit('❌ ffmpeg 실패:\n' + res.stderr[-1500:])

    total = sum(sec for _, sec in plan)
    print(f'✅ {dst}  ({os.path.getsize(dst)//1024}KB, 약 {total:.1f}초, {len(plan)}컷)')
    print('   음악은 인스타 앱에서 트렌딩 오디오를 얹으세요.')


if __name__ == '__main__':
    main()
