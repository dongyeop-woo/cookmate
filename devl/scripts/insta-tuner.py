#!/usr/bin/env python3
"""
인스타 카드 커버를 슬라이더로 보면서 맞추는 도구.

사용:
  python3 scripts/insta-tuner.py --title "환절기엔|뜨끈한 국물" --ids 213,205,106,107

브라우저가 열리면 슬라이더를 움직이는 대로 미리보기가 갱신된다.
"저장" 을 누르면 data/insta-style.json 에 기록되고,
이후 gen-insta-cards.py 가 그 값을 그대로 쓴다.
"""
import argparse, importlib.util, io, json, os, sys, threading, webbrowser
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse, parse_qs

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('gen', os.path.join(HERE, 'gen-insta-cards.py'))
gen = importlib.util.module_from_spec(spec)
sys.modules['gen'] = gen
spec.loader.exec_module(gen)

STATE = {'title': '', 'ids': [], 'recipes': None}

CONTROLS = [
    ('title_max',    '제목 최대 크기',    90,  200, 2),
    ('stroke_white', '흰 테두리 (작을수록 두껍게)',  4,   20, 1),
    ('stroke_black', '검정 테두리 (작을수록 두껍게)', 8,   30, 1),
    ('mascot_scale', '마스코트 크기',     0.6, 2.0, 0.05),
    ('mascot_dy',    '마스코트 위아래',  -60,  60, 1),
    ('mascot_dx',    '마스코트 좌우',    -260, 260, 2),
    ('hue_shift',    '두 줄 색 차이',     0.0, 0.5, 0.005),
    ('mark_size',    '셰프모자 크기',     60,  260, 4),
]

HTML = """<!doctype html><html lang=ko><meta charset=utf-8>
<title>요잘알 카드 튜너</title>
<style>
 body{margin:0;background:#15161a;color:#e8e8ea;font:14px/1.5 -apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo",sans-serif;
      display:flex;gap:28px;padding:28px;align-items:flex-start}
 img{width:520px;height:520px;border-radius:14px;background:#000;box-shadow:0 10px 40px rgba(0,0,0,.5)}
 .panel{width:330px}
 h1{font-size:16px;margin:0 0 18px;font-weight:600}
 .row{margin-bottom:16px}
 .row label{display:flex;justify-content:space-between;font-size:12px;color:#a9adb8;margin-bottom:5px}
 .row b{color:#7fe0b0;font-weight:600}
 input[type=range]{width:100%;accent-color:#1BAE74}
 button{width:100%;padding:11px;margin-top:8px;border:0;border-radius:9px;background:#1BAE74;color:#fff;
        font-size:14px;font-weight:600;cursor:pointer}
 button.ghost{background:#2a2d35;color:#c9cdd6}
 #msg{margin-top:10px;font-size:12px;color:#7fe0b0;min-height:16px}
</style>
<div><img id=pv src="/render"></div>
<div class=panel>
 <h1>커버 조절</h1>
 <div id=rows></div>
 <button onclick="save()">현재 값 저장</button>
 <button class=ghost onclick="reset()">기본값으로</button>
 <div id=msg></div>
</div>
<script>
const C = __CONTROLS__, V = __VALUES__;
const rows = document.getElementById('rows');
for (const [k,label,min,max,step] of C) {
  const d = document.createElement('div'); d.className='row';
  d.innerHTML = `<label><span>${label}</span><b id="v_${k}">${V[k]}</b></label>
    <input type=range id="${k}" min="${min}" max="${max}" step="${step}" value="${V[k]}">`;
  rows.appendChild(d);
}
let t=null;
function params(){ const p=new URLSearchParams(); for(const [k] of C) p.set(k, document.getElementById(k).value); return p; }
function refresh(){
  for(const [k] of C) document.getElementById('v_'+k).textContent = document.getElementById(k).value;
  clearTimeout(t); t=setTimeout(()=>{ document.getElementById('pv').src='/render?'+params().toString()+'&_='+Date.now(); },140);
}
for(const [k] of C) document.getElementById(k).addEventListener('input', refresh);
function save(){ fetch('/save?'+params().toString()).then(r=>r.text()).then(x=>{document.getElementById('msg').textContent=x;}); }
function reset(){ fetch('/reset').then(r=>r.json()).then(v=>{ for(const [k] of C){ document.getElementById(k).value=v[k]; } refresh(); }); }
</script></html>"""


class H(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def _style(self, q):
        st = dict(gen.STYLE_DEFAULT)
        st.update(gen.load_style())
        for k, *_ in CONTROLS:
            if k in q:
                v = float(q[k][0])
                st[k] = int(v) if k not in ('mascot_scale', 'hue_shift') else v
        return st

    def do_GET(self):
        u = urlparse(self.path)
        q = parse_qs(u.query)
        if u.path == '/':
            vals = {k: (gen.load_style().get(k, gen.STYLE_DEFAULT[k])) for k, *_ in CONTROLS}
            body = (HTML.replace('__CONTROLS__', json.dumps(CONTROLS, ensure_ascii=False))
                        .replace('__VALUES__', json.dumps(vals)))
            self._send(200, 'text/html; charset=utf-8', body.encode())
        elif u.path == '/render':
            gen.STYLE = self._style(q)
            picked = [STATE['recipes'][i] for i in STATE['ids']]
            img = gen.make_cover(picked[0]['image'], STATE['title'], '')
            buf = io.BytesIO(); img.save(buf, 'PNG')
            self._send(200, 'image/png', buf.getvalue())
        elif u.path == '/save':
            st = self._style(q)
            os.makedirs(os.path.dirname(gen.STYLE_FILE), exist_ok=True)
            json.dump(st, open(gen.STYLE_FILE, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
            self._send(200, 'text/plain; charset=utf-8',
                       f'저장됨 → data/insta-style.json'.encode())
        elif u.path == '/reset':
            self._send(200, 'application/json', json.dumps(gen.STYLE_DEFAULT).encode())
        else:
            self._send(404, 'text/plain', b'')

    def _send(self, code, ctype, body):
        self.send_response(code)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(body)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--title', required=True)
    ap.add_argument('--ids', required=True)
    ap.add_argument('--port', type=int, default=8765)
    a = ap.parse_args()

    STATE['title'] = a.title
    STATE['ids'] = [s.strip() for s in a.ids.split(',') if s.strip()]
    print('[tuner] 레시피 불러오는 중...')
    STATE['recipes'] = gen.fetch_recipes()
    missing = [i for i in STATE['ids'] if i not in STATE['recipes']]
    if missing:
        sys.exit(f'❌ 없는 id: {", ".join(missing)}')
    gen.fetch_image(STATE['recipes'][STATE['ids'][0]]['image'])   # 이미지 캐시 예열

    url = f'http://127.0.0.1:{a.port}/'
    print(f'[tuner] {url} — 브라우저에서 조절하세요. 끝내려면 Ctrl+C')
    threading.Timer(0.6, lambda: webbrowser.open(url)).start()
    HTTPServer(('127.0.0.1', a.port), H).serve_forever()


if __name__ == '__main__':
    main()
