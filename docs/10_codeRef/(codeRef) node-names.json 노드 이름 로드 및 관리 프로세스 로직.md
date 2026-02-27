---
tags:
상태: Ref
중요: 1
생성일: 26-02-24T10:35:50
수정일: 26-02-24T10:43:16
종료일:
라벨:
  - codeRef
summary:
---
## 0. 참고 레퍼런스
- 
##  ■■ Description ■■
- **node-names.json**, **NodeNameLoader.ts**, **NodeNameManager.ts** 파일들이 어떻게 협력하여 노드 이름을 관리하는지 설명한다.
## 1. 동작 순서도
```
┌─────────────────────────────────────────────────────────────┐
│ 1. DamperAssemblyService.initialize()                       │
│    └─> getNodeNameManager() 호출                             │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. NodeNameManager.getInstance() (Singleton)                │
│    └─> 인스턴스 없으면 생성, 있으면 기존 인스턴스 반환             │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. nodeNameManager.enableMetadataMode()                     │
│    └─> getNodeNameLoader() 호출                              │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. NodeNameLoader.loadNodeNames()                           │
│    └─> fetch('/metadata/node-names.json') 호출               │
│    └─> JSON 데이터 파싱 후 메모리에 저장                        │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. nodeNameManager.getNodeName('fridge.leftDoorDamper...')  │
│    └─> NodeNameLoader.getNodeName(path) 호출                 │
│    └─> 점(.) 표기법으로 JSON 트리 탐색                         │
│    └─> 실제 3D 노드 이름 반환                                  │
└─────────────────────────────────────────────────────────────┘
```
## 2. 상세 함수 절차
### 2-1단계: DamperAssemblyService 초기화
```typescript
// DamperAssemblyService.ts - line 26-27
const nodeNameManager = getNodeNameManager();
nodeNameManager.enableMetadataMode();
```
-`DamperAssemblyService.initialize()`에서 `getNodeNameManager()`를 호출하여 singleton 인스턴스를 가져온다.
### 2-2단계: NodeNameManager singleton 생성
```typescript
// NodeNameManager.ts - line 16-21
public static getInstance(): NodeNameManager {
    if (!NodeNameManager.instance) {
        NodeNameManager.instance = new NodeNameManager();
    }
    return NodeNameManager.instance;
}
```
- `NodeNameManager.getInstance()`는 singleton 패턴을 구현하여 인스턴스를 관리한다.
### 2-3단계: 메타데이터 모드 활성화
```typescript
// NodeNameManager.ts - line 29-35
public async enableMetadataMode(): Promise<void> {
    const loader = getNodeNameLoader();
    if (!loader.isLoadedData()) {
        await loader.loadNodeNames();
    }
    this.useMetadata = true;
}
```
- `enableMetadataMode()`에서 `getNodeNameLoader()`를 호출하여 로더 인스턴스를 가져온다.
- 데이터가 아직 로드되지 않았으면 `loadNodeNames()`를 호출하여 JSON 파일을 로드한다.
### 2-4단계: node-names.json 파일 로드
```typescript
// NodeNameLoader.ts - line 24-36
public async loadNodeNames(): Promise<void> {
    try {
        const response = await fetch(this.nodeNamesPath);  // '/metadata/node-names.json'
        this.nodeNames = await response.json();
        this.isLoaded = true;
    } catch (error) {
        console.error('노드 이름 로드 실패:', error);
        throw error;
    }
}
```
- `NodeNameLoader.loadNodeNames()`는 `/metadata/node-names.json` 파일을 HTTP GET 요청으로 로드한다.
- JSON 데이터는 다음과 같은 계층 구조를 가진다:
```json
{
  "fridge": {
    "leftDoorDamper": {
      "damperCoverBody": "MCK71751101_Cover,Body_3117001",
      "damperAssembly": "ACV74674704_Damper_Assembly_13473"
    }
  }
}
```
### 2-5단계: 노드 이름 조회
```typescript
// NodeNameLoader.ts - line 43-61
public getNodeName(path: string): string | null {
    const keys = path.split('.');  // 'fridge.leftDoorDamper.damperCoverBody' → ['fridge', 'leftDoorDamper', 'damperCoverBody']
    let current: any = this.nodeNames;

    for (const key of keys) {
        if (current[key] === undefined) return null;
        current = current[key];
    }
    return current as string;
}
```
- `getNodeName(path)`은 점(.) 표기법을 사용하여 JSON 트리를 탐색한다.
- 예: `'fridge.leftDoorDamper.damperCoverBody'` → `"MCK71751101_Cover,Body_3117001"` 반환
### 2-6단계: DamperAssemblyService에서 사용
```typescript
// DamperAssemblyService.ts - line 62-67
const damperAssembly = this.sceneRoot.getObjectByName(
    nodeNameManager.getNodeName('fridge.leftDoorDamper.damperAssembly')!
);
```
- `nodeNameManager.getNodeName()`을 통해 논리적 키(예: `'fridge.leftDoorDamper.damperAssembly'`)를 실제 3D 노드 이름(예: `'ACV74674704_Damper_Assembly_13473'`)으로 변환한다.
- 변환된 이름을 `THREE.Object3D.getObjectByName()`에 전달하여Scene Graph에서 해당 노드를 찾는다.
## 3. 아키텍처 요약
| 파일                                                                             | 역할                         | 주요 메서드                                        |
| ------------------------------------------------------------------------------ | -------------------------- | --------------------------------------------- |
| **[node-names.json](public/metadata/node-names.json)**                         | 노드 이름 메타데이터 저장소 (JSON)     | -                                             |
| **[NodeNameLoader.ts](src/services/data/NodeNameLoader.ts)**                   | JSON 파일을 HTTP로 로드하고 파싱     | `loadNodeNames()`, `getNodeName(path)`        |
| **[NodeNameManager.ts](src/services/data/NodeNameManager.ts)**                 | 노드 이름 조회Facade (Singleton) | `enableMetadataMode()`, `getNodeName(key)`    |
| **[DamperAssemblyService.ts](src/services/assembly/DamperAssemblyService.ts)** | 실제 3D 노드 조작 서비스            | `initialize()`, `debugPrintDamperStructure()` |
## 4. 핵심 포인트
1. **Lazy Loading**: `node-names.json`은 `enableMetadataMode()`가 처음 호출될 때만 로드된다.
2. **점 표기법 지원**: `'fridge.leftDoorDamper.damperCoverBody'`와 같은 계층적 키를 사용하여JSON 구조를 탐색한다.
3. **Singleton 패턴**: `NodeNameManager`와 `NodeNameLoader`모두 singleton으로 구현되어 메모리를 효율적으로 사용한다.
4. **메타데이터 모드 토글**: `enableMetadataMode()`/`disableMetadataMode()`로 메타데이터 사용 여부를 전환할 수 있다.
