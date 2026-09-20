/**
 * 전체 유저 1회성 푸시 발송 스크립트.
 *
 * 사용법:
 *   # 테스트: 본인 이메일에만
 *   node scripts/broadcast-push.js --email dongyeopwoo1@gmail.com
 *
 *   # 테스트: 특정 UID에만
 *   node scripts/broadcast-push.js --uid <UID>
 *
 *   # 전체 발송 (yes 확인 후 실행)
 *   node scripts/broadcast-push.js --all
 *
 * 제목/내용은 아래 TITLE / BODY 상수를 수정하세요.
 * 탈퇴 유저(status='withdrawn')와 푸시 토큰 없는 유저는 자동 제외됩니다.
 */

const admin = require('firebase-admin');
const readline = require('readline');
const serviceAccount = require('../cookingbasedyw-firebase-adminsdk-fbsvc-b11f8d8de0.json');

const TITLE = '휴일인데 밥은?';
const BODY = '나랑 같이 요리하지 않을래...?';
const CATEGORY = 'event';
const ROUTE = null;

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const PUSH_CHUNK = 100;
const FIRESTORE_BATCH = 400;

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
db.settings({ databaseId: 'cookmate' });

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { mode: null, value: null };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--all') out.mode = 'all';
    else if (args[i] === '--email') { out.mode = 'email'; out.value = args[++i]; }
    else if (args[i] === '--uid') { out.mode = 'uid'; out.value = args[++i]; }
  }
  return out;
}

async function fetchTargets({ mode, value }) {
  let docs;
  if (mode === 'uid') {
    const snap = await db.collection('users').doc(value).get();
    if (!snap.exists) throw new Error(`UID ${value} 없음`);
    docs = [snap];
  } else if (mode === 'email') {
    const snap = await db.collection('users').where('email', '==', value).get();
    docs = snap.docs;
  } else {
    const snap = await db.collection('users').get();
    docs = snap.docs;
  }
  return docs
    .map(d => ({ uid: d.id, ...d.data() }))
    .filter(u => u.pushToken && u.status !== 'withdrawn')
    .map(u => ({ uid: u.uid, token: u.pushToken, email: u.email, nickname: u.nickname }));
}

async function sendPush(targets) {
  let ok = 0, ng = 0;
  for (let i = 0; i < targets.length; i += PUSH_CHUNK) {
    const chunk = targets.slice(i, i + PUSH_CHUNK);
    const messages = chunk.map(t => ({
      to: t.token,
      title: TITLE,
      body: BODY,
      sound: 'default',
      priority: 'high',
      channelId: 'default-v2',
    }));
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(messages),
    });
    const json = await res.json();
    const tickets = json.data || [];
    tickets.forEach((t, idx) => {
      if (t.status === 'ok') ok++;
      else {
        ng++;
        console.warn(`  ⚠️  ${chunk[idx].email || chunk[idx].uid}: ${t.message || t.details?.error || 'unknown'}`);
      }
    });
    process.stdout.write(`  📤 ${Math.min(i + PUSH_CHUNK, targets.length)}/${targets.length}\r`);
  }
  console.log(`\n  ✅ 성공 ${ok}건 / ❌ 실패 ${ng}건`);
}

async function saveHistory(targets) {
  const now = new Date().toISOString();
  for (let i = 0; i < targets.length; i += FIRESTORE_BATCH) {
    const chunk = targets.slice(i, i + FIRESTORE_BATCH);
    const batch = db.batch();
    chunk.forEach(t => {
      const ref = db.collection('notifications').doc();
      const payload = {
        uid: t.uid,
        title: TITLE,
        body: BODY,
        category: CATEGORY,
        read: false,
        createdAt: now,
      };
      if (ROUTE) payload.route = ROUTE;
      batch.set(ref, payload);
    });
    await batch.commit();
  }
  console.log(`  📝 알림 이력 저장: ${targets.length}건`);
}

function ask(q) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(r => rl.question(q, ans => { rl.close(); r(ans); }));
}

(async () => {
  const opts = parseArgs();
  if (!opts.mode) {
    console.error('사용법: node scripts/broadcast-push.js (--all | --email <email> | --uid <uid>)');
    process.exit(1);
  }
  if ((opts.mode === 'email' || opts.mode === 'uid') && !opts.value) {
    console.error(`❌ --${opts.mode} 인자 값이 비어있습니다.`);
    process.exit(1);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📨 제목: ${TITLE}`);
  console.log(`📨 내용: ${BODY}`);
  console.log(`📨 카테고리: ${CATEGORY}`);
  console.log(`📨 모드: ${opts.mode}${opts.value ? ` (${opts.value})` : ''}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const targets = await fetchTargets(opts);
  console.log(`\n📊 발송 대상: ${targets.length}명 (푸시 토큰 보유 + 비탈퇴)`);
  if (targets.length === 0) {
    console.log('❌ 대상 없음. 종료.');
    process.exit(0);
  }
  if (targets.length <= 5) {
    targets.forEach(t => console.log(`   - ${t.email || t.uid} (${t.nickname || '닉네임 없음'})`));
  }

  if (opts.mode === 'all') {
    const ans = await ask(`\n⚠️  정말 ${targets.length}명 전체에게 발송하시겠습니까? (yes 입력): `);
    if (ans.trim().toLowerCase() !== 'yes') {
      console.log('취소됨.');
      process.exit(0);
    }
  }

  console.log('\n🚀 푸시 전송 시작...');
  await sendPush(targets);
  await saveHistory(targets);
  console.log('\n✨ 완료\n');
  process.exit(0);
})().catch(e => {
  console.error('\n❌ 실패:', e);
  process.exit(1);
});
