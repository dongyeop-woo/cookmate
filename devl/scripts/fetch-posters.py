#!/usr/bin/env python3
"""
영어 위키백과에서 영화 포스터를 받아 assets/posters/ 에 저장한다.

    python3 scripts/fetch-posters.py --content data/movie/titles.json

한국어 위키는 비자유 파일을 아예 호스팅하지 않아서(엄격한 공정이용 불허 방침)
영어 위키만 본다. 문서명은 자동 추론이 자주 빗나가므로 JSON 에 직접 적는다.

주의: 영화 포스터는 배급사 저작권물이다. 영어 위키는 '공정이용' 근거로 올려두지만
그 근거가 상업 SNS 게시물까지 덮어주지는 않는다. 쓰는 쪽이 판단할 문제다.
"""
import argparse, json, os, re, time, urllib.parse, urllib.request

BASE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OUT = os.path.join(BASE, 'assets', 'posters')
UA = {'User-Agent': 'cookmate-card-gen/1.0 (personal project)'}


def _get(url, tries=3):
    """연속으로 때리면 위키가 막는다. 실패하면 간격을 늘려 다시 시도한다."""
    for n in range(tries):
        try:
            r = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=25)
            time.sleep(0.25)
            return json.load(r)
        except Exception:
            time.sleep(0.8 * (n + 1))
    return {}


def api(params):
    return _get('https://en.wikipedia.org/w/api.php?' + urllib.parse.urlencode(params))


def via_summary(title):
    u = ('https://en.wikipedia.org/api/rest_v1/page/summary/'
         + urllib.parse.quote(title.replace(' ', '_')))
    d = _get(u)
    src = (d.get('originalimage') or d.get('thumbnail') or {}).get('source')
    return src if src and '/commons/' not in src else None


def via_pageimages(title):
    d = api({'action': 'query', 'format': 'json', 'prop': 'pageimages',
             'piprop': 'original', 'titles': title, 'redirects': '1'})
    for p in d.get('query', {}).get('pages', {}).values():
        src = (p.get('original') or {}).get('source', '')
        if src and '/commons/' not in src:
            return src
    return None


def via_imagelist(title):
    """문서에 걸린 파일 중 이름에 poster 가 든 것. 마지막 수단."""
    d = api({'action': 'query', 'format': 'json', 'prop': 'images',
             'titles': title, 'imlimit': 60, 'redirects': '1'})
    files = []
    for p in d.get('query', {}).get('pages', {}).values():
        files = [i['title'] for i in p.get('images', [])]
    # 파일명에 poster 가 없는 문서도 많다(예: "The Matrix Poster.jpg" 가 아니라 "Matrix.jpg").
    # 이름으로 못 거르면 앞쪽 파일들을 훑어 commons 가 아닌 것(=비자유 포스터)을 집는다.
    named = [f for f in files if re.search(r'poster', f, re.I)]
    others = [f for f in files
              if re.search(r'\.(jpg|jpeg|png)$', f, re.I)
              and not re.search(r'logo|icon|flag|wiki|commons|star|symbol|edit|ambox|question',
                                f, re.I)]
    for f in (named + others)[:6]:
        i = api({'action': 'query', 'format': 'json', 'prop': 'imageinfo',
                 'titles': f, 'iiprop': 'url', 'iiurlwidth': 500})
        for p in i.get('query', {}).get('pages', {}).values():
            ii = (p.get('imageinfo') or [{}])[0]
            src = ii.get('thumburl') or ii.get('url')
            if src and '/commons/' not in src:
                return src
    return None


def resolve(en_title):
    for t in (en_title, f'{en_title} (film)'):
        for fn in (via_summary, via_pageimages, via_imagelist):
            u = fn(t)
            if u:
                return u
    return None


def slug(s):
    return re.sub(r'[^0-9a-zA-Z]+', '-', s).strip('-').lower()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--content', required=True, help='[{ko, en}] 목록 JSON')
    a = ap.parse_args()
    os.makedirs(OUT, exist_ok=True)
    rows = json.load(open(a.content, encoding='utf-8'))

    ipath = os.path.join(OUT, 'index.json')
    got = json.load(open(ipath, encoding='utf-8')) if os.path.exists(ipath) else {}
    for r in rows:
        ko, en = r['ko'], r['en']
        name = slug(en) + '.jpg'
        path = os.path.join(OUT, name)
        if os.path.exists(path):
            got[ko] = name
            print(f'· {ko:26} 이미 있음')
            continue
        u = resolve(en)
        if not u:
            print(f'✗ {ko:26} {en}')
            continue
        try:
            time.sleep(0.5)          # 429 를 부르지 않게 간격을 둔다
            data = urllib.request.urlopen(
                urllib.request.Request(u, headers=UA), timeout=30).read()
            open(path, 'wb').write(data)
            got[ko] = name
            print(f'✓ {ko:26} {len(data)//1024}KB')
        except Exception as e:
            print(f'✗ {ko:26} 내려받기 실패 {e}')

    json.dump(got, open(ipath, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
    print(f'\n{len(got)}/{len(rows)} 확보 → assets/posters/index.json')


if __name__ == '__main__':
    main()
