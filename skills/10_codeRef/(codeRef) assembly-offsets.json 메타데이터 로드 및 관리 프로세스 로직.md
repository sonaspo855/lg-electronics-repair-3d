---
tags:
상태: Ref
중요:
생성일: 26-02-24T11:49:54
수정일: 26-02-26T08:47:30
종료일:
라벨:
  - codeRef
summary:
---
## 0. 참고 레퍼런스
- 
##  ■■ Description ■■
- MetadataLoader.ts 파일은 JSON 메타데이터 파일(assembly-offsets.json, damper-animations.json 등)을 로드하고 조회하는 역할을 한다.
- **브라우저 초기 로드 시 한 번만 로드** 되며, 이후에는 **캐시된 데이터를 사용** 한다.
# 메타데이터 초기화 프로세스 분석
## 1. 메타데이터 파일 경로 결정 (ManualEditorPage.tsx)
- `ManualEditorPage.tsx:537-552`에서 메타데이터 파일의 경로는 다음 로직으로 결정됩니다:
### 기본 경로 설정
```typescript
let metadataPath = '/metadata/assembly-offsets.json';  // 기본값 (냉장고)
```
### 모델 타입에 따른 동적 변경
```typescript
if (modelPath) {
    const fileName = modelPath.split('/').pop() || '';
    if (fileName.startsWith('WM_') || fileName.includes('Washing')) {
        metadataPath = '/metadata/washing-metadata.json';  // 세탁기
    }
}
```

| 조건 | 메타데이터 파일 |
|------|----------------|
| 기본 (냉장고 등) | `/metadata/assembly-offsets.json` |
| `WM_` 또는 `Washing` 포함 | `/metadata/washing-metadata.json` |
## 2. `metadataLoader.initialize(metadataPath)` 동작 프로세스
`MetadataLoader.initialize()`를 중심으로 전체 데이터 흐름은 다음과 같습니다:
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     MetadataLoader.initialize(metadataPath)                 │
├─────────────────────────────────────────────────────────────────────────────┤
│  Step 1: NodeNameLoader를 통한 노드 이름 데이터 로드                            │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ NodeNameLoader.getInstance().loadNodeNames()                          │  │
│  │  → /metadata/node-names.json 파일을 fetch하여 로드                       │  │
│  │  → 노드 경로 참조(ref:)를 해결하기 위한基础 데이터 준비                      │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  Step 2: MetadataService에 파일 경로 설정                                     │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ MetadataService.setMetadataPath(metadataPath)                         │  │
│  │  → MetadataRepository.setFilePath(path) 호출                           │  │
│  │  → assemblyCache.clear() (기존 캐시 삭제)                               │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  Step 3: 메타데이터 파일 로드                                                  │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ MetadataLoader.loadMetadata()                                         │  │
│  │  → MetadataService.initialize()                                       │  │
│  │    → MetadataRepository.loadMetadata()                                │  │
│  │       → fetch(metadataPath + '?t=' + Date.now())                      │  │
│  │       → JSON 파싱 후 this.metadata에 캐시                               │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  Step 4: 초기화 완료 로그                                                     │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ console.log(`메타데이터 전역 초기화 완료 (${metadataPath})`);             │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```
### 상세 단계별 동작
| 순서  | 클래스                  | 메서드                 | 동작 내용                                      |
| --- | -------------------- | ------------------- | ------------------------------------------ |
| 1   | `NodeNameLoader`     | `loadNodeNames()`   | `/metadata/node-names.json` 로드 (노드 경로 매핑용) |
| 2   | `MetadataService`    | `setMetadataPath()` | 파일 경로 설정 및 캐시 초기화                          |
| 3   | `MetadataRepository` | `setFilePath()`     | 내부 `filePath` 업데이트                         |
| 4   | `MetadataLoader`     | `loadMetadata()`    | 실제 JSON 파일 fetch 및 파싱                      |
| 5   | `MetadataService`    | `initialize()`      | Repository를 통한 메타데이터 로드                    |
| 6   | `MetadataRepository` | `loadMetadata()`    | `fetch()`로 JSON 파일 요청, 캐시 저장               |
### 주요 캐싱 메커니즘
- **MetadataRepository**: `this.metadata`에 로드된 JSON을 캐시하여 중복 fetch 방지
- **MetadataService**: `assemblyCache` Map을 통해 어셈블리 설정 캐싱
- **NodeNameLoader**: `this.isLoaded` 플래그로 중복 로드 방지
## 3. 사용 시 유의사항
1. **초기화 시점**: `ManualEditorPage.tsx`의 `useEffect`에서 `modelPath` 변경 시마다 재실행
```tsx
// 메타데이터 전역 초기화
useEffect(() => {
// 모델 경로에 따라 메타데이터 파일 경로 결정
let metadataPath = '/metadata/assembly-offsets.json';

// 현재 메타데이터 로드방식: modelPath 에 `WM_` 포함 되어 있을 경우 세탁기로 인식하여, washing-metadata.json 로드 되게 수정
if (modelPath) {
  const fileName = modelPath.split('/').pop() || '';
  if (fileName.startsWith('WM_') || fileName.includes('Washing')) {
	metadataPath = '/metadata/washing-metadata.json';
	console.log(`세탁기 모델 감지: ${metadataPath} 로드`);
  }
}
```
1. **캐시 클리어**: 경로가 변경되면 기존 캐시가 자동으로 삭제됨
2. **비동기 처리**: `initialize()`는 `Promise<void>`를 반환하므로 필요한 경우 `await` 사용 가능
