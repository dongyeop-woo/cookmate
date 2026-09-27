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
    # 패널을 560 으로 고정했더니 한두 줄짜리 단계에서 흰 여백이 절반이었다.
    # 글 길이에 맞춰 잡고 남는 높이는 사진이 가져가게 한다.
    _d0 = ImageDraw.Draw(card)
    _txt = gen.condense(st['description'], r.get('ingredients'))
    _n = len(gen.wrap(_d0, _txt, gen.hand(52), VW - 130)[:4])
    box_h = 130 + _n * 66 + 120
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
        # 화면 맨 아래에 두면 설명 마지막 줄과 겹친다. 스텝 배지와 같은 줄에 놓는다.
        d.text((VW - 64, top), f'{t}', font=gen.font(52), fill=gen.GREEN_DEEP, anchor='rm')
    return card


def frame_outro(r):
    """아웃트로 — 정사각 카드를 가운데 놓으면 위아래가 텅 빈다. 9:16 으로 그린다."""
    # make_outro 는 정사각 기준으로 좌표가 잡혀 있어 1920 높이로 그리면 요소가
    # 작게 떠 버린다. 정사각으로 그려 가운데 두는 쪽이 보기 낫다(배경이 흰색이라
    # 위아래 여백이 티나지 않는다).
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
    ap.add_argument('--motion', choices=['on', 'off'], default='on',
                    help='컷마다 천천히 확대/축소 (기본 on)')
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

    # 컷마다 천천히 확대/축소(켄번스). 정지 이미지를 그냥 이어붙이면 슬라이드쇼로
    # 보여서 릴스에서 바로 넘겨진다. 방향을 번갈아 주면 컷 전환이 또렷해진다.
    #
    # zoompan 은 입력 해상도가 낮으면 떨림이 생긴다. 2배로 키운 뒤 줌을 준다.
    listing = []
    for i, (im, sec) in enumerate(plan):
        src = os.path.join(tmp, f'{i:03d}.png')
        im.save(src)
        clip = os.path.join(tmp, f'{i:03d}.mp4')
        n = max(2, int(sec * FPS))
        if a.motion == 'off':
            z = '1'
        elif i % 2 == 0:
            z = f'min(1+0.10*on/{n},1.10)'      # 들어가며 확대
        else:
            z = f'max(1.10-0.10*on/{n},1.0)'    # 빠지며 축소
        vf = (f"scale={VW*2}:{VH*2},zoompan=z='{z}':d={n}"
              f":x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'"
              f":s={VW}x{VH}:fps={FPS},format=yuv420p")
        rc = subprocess.run(
            ['ffmpeg', '-y', '-loop', '1', '-i', src, '-vf', vf, '-t', str(sec),
             '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', clip],
            capture_output=True, text=True)
        if rc.returncode != 0:
            shutil.rmtree(tmp, ignore_errors=True)
            sys.exit('❌ 컷 렌더 실패:\n' + rc.stderr[-1200:])
        listing.append(f"file '{clip}'")
    lst = os.path.join(tmp, 'list.txt')
    open(lst, 'w').write('\n'.join(listing) + '\n')

    os.makedirs(a.out, exist_ok=True)
    dst = os.path.join(a.out, f"{r['id']}_{r['title'].replace(' ', '')}.mp4")
    cmd = ['ffmpeg', '-y', '-f', 'concat', '-safe', '0', '-i', lst,
           '-c', 'copy', '-movflags', '+faststart', dst]
    res = subprocess.run(cmd, capture_output=True, text=True)
    shutil.rmtree(tmp, ignore_errors=True)
    if res.returncode != 0:
        sys.exit('❌ ffmpeg 실패:\n' + res.stderr[-1500:])

    total = sum(sec for _, sec in plan)
    print(f'✅ {dst}  ({os.path.getsize(dst)//1024}KB, 약 {total:.1f}초, {len(plan)}컷)')
    print('   음악은 인스타 앱에서 트렌딩 오디오를 얹으세요.')


if __name__ == '__main__':
    main()
