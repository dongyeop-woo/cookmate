# Firestore 자동 백업 설정

프로덕션 데이터 유실/해킹/관리자 실수 대비 — 주 1회 Cloud Storage로 자동 export.

## 1. GCS 백업 버킷 생성 (1회)

```bash
# 프로젝트 ID 설정
export PROJECT_ID=cookingbasedyw
export BUCKET=${PROJECT_ID}-firestore-backups
export REGION=asia-northeast3

# 버킷 생성 (Seoul 리전, Coldline - 백업용 저비용)
gsutil mb -l ${REGION} -c coldline gs://${BUCKET}

# 라이프사이클: 90일 이상 된 백업 자동 삭제
cat > /tmp/lifecycle.json <<EOF
{
  "lifecycle": {
    "rule": [
      {
        "action": {"type": "Delete"},
        "condition": {"age": 90}
      }
    ]
  }
}
EOF
gsutil lifecycle set /tmp/lifecycle.json gs://${BUCKET}
```

## 2. Firestore Export 권한 부여

```bash
# Cloud Scheduler가 Firestore export를 트리거할 수 있도록 권한 부여
SERVICE_ACCOUNT=$(gcloud projects describe ${PROJECT_ID} --format="value(projectNumber)")-compute@developer.gserviceaccount.com

# Firestore Import/Export 권한
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
    --member="serviceAccount:${SERVICE_ACCOUNT}" \
    --role="roles/datastore.importExportAdmin"

# GCS 쓰기 권한
gsutil iam ch serviceAccount:${SERVICE_ACCOUNT}:objectAdmin gs://${BUCKET}
```

## 3. Cloud Scheduler 작업 등록

```bash
# 매주 일요일 새벽 4시 (KST) 백업
gcloud scheduler jobs create http firestore-weekly-backup \
    --location=${REGION} \
    --schedule="0 4 * * 0" \
    --time-zone="Asia/Seoul" \
    --uri="https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default):exportDocuments" \
    --http-method=POST \
    --oauth-service-account-email="${SERVICE_ACCOUNT}" \
    --message-body='{"outputUriPrefix":"gs://'${BUCKET}'/weekly"}'
```

## 4. 수동 백업 (즉시 실행)

```bash
# 긴급 백업이 필요할 때 (대규모 마이그레이션 직전 등)
gcloud firestore export gs://${BUCKET}/manual-$(date +%Y%m%d-%H%M)
```

## 5. 복구 방법 (재난 시)

```bash
# 특정 날짜 백업 확인
gsutil ls gs://${BUCKET}/weekly/

# 전체 복원 (⚠️ 기존 데이터 덮어씀)
gcloud firestore import gs://${BUCKET}/weekly/2026-04-21T00:00:00_abc123/

# 특정 컬렉션만 복원
gcloud firestore import \
    --collection-ids=recipes,community \
    gs://${BUCKET}/weekly/2026-04-21T00:00:00_abc123/
```

## 6. 비용 예상

- **스토리지**: Coldline $0.004/GB/월. 현재 DB가 1GB 미만이면 월 ₩5~10.
- **Export 요청**: 무료 (Firestore Admin API).
- **네트워크**: 내부 전송은 무료.

## 7. 검증 체크리스트

- [ ] 버킷 생성 완료 (`gsutil ls gs://${BUCKET}`)
- [ ] 첫 수동 백업 실행해서 export 파일 생성 확인
- [ ] Cloud Scheduler 작업 `firestore-weekly-backup` 상태 "enabled"
- [ ] 월 1회 복구 훈련 (dev 프로젝트에서 import 테스트)
- [ ] 90일 라이프사이클 정책 적용 확인 (`gsutil lifecycle get gs://${BUCKET}`)
