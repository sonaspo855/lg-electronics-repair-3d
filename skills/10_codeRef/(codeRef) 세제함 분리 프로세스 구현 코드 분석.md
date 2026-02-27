---
tags:
  - Ref
상태: Todo
중요:
생성일: 26-02-27T08:57:39
수정일: 26-02-27T09:06:30
종료일:
라벨:
  - codeRef
summary:
작업순서: 1
---
## 0. 참고 레퍼런스
- 
##  ■■ Description ■■
- `SelectionHandler.ts:57-58`의 코드는 **세제함(Panel Drawer) 분리 애니메이션**을 trigger하는 핵심 진입점이다. 
- 이 코드는 사용자가 세제함을 클릭했을 때 분리 애니메이션을 실행하는 전체 플로우의 시작점이다.

## 2. 구현 방식
### 2.1 아키텍처 개요
```
┌─────────────────────────────────────────────────────────────────────────┐
│                        세제함 분리 애니메이션 아키텍처                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  SelectionHandler.handleDefaultClick()                                  │
│           │                                                             │
│           ▼                                                             │
│  ┌────────────────────────────────────────────────────────────────┐     │
│  │ PanelDrawerServiceOrchestrator.handleDrawerClick()             │     │
│  │  - 노드 이름 검증 (drawerAssembly / drawer)                      │     │
│  │  - 토글 신호 발생                                                │     │
│  └────────────────────────────────────────────────────────────────┘     │
│           │                                                             │
│           ▼                                                             │
│  ┌────────────────────────────────────────────────────────────────┐     │
│  │ PanelDrawerAnimationService.toggleDrawer()                     │     │
│  │  - 분해/조립 상태 플래그 확인                                           │ 
│  │  - disassembleDrawer() 또는 assembleDrawer() 호출               │     │
│  └────────────────────────────────────────────────────────────────┘     │
│           │                                                             │
│           ▼                                                             │
│  ┌────────────────────────────────────────────────────────────────┐     │
│  │ GSAP Timeline 애니메이션 실행                                     │     │
│  │  - 메타데이터 기반 설정 (방향, 거리, 시간, 이징)                     │     │
│  │  - drawerAssembly + drawer 노드 동시 이동                        │     │
│  └────────────────────────────────────────────────────────────────┘     │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```
### 2.2 핵심 구현 기술
| 구분              | 기술                                      |
| --------------- | --------------------------------------- |
| **애니메이션 라이브러리** | GSAP (GreenSock Animation Platform)     |
| **설정 관리**       | 메타데이터 JSON 파일 (`washing-metadata.json`) |
| **노드 탐색**       | `sceneRoot.getObjectByName()`           |
| **좌표 변환**       | `localToWorld()` / `worldToLocal()`     |
| **상태 관리**       | `isDisassembled` 플래그 (토글용)              |
| **위치 저장**       | `originalPositions` Map                 |
## 3 세부 단계별 동작
### 1단계 - SelectionHandler (진입점)
```typescript
// src/services/detection/SelectionHandler.ts
private handleDefaultClick(hit: THREE.Intersection) {
    const clickedObject = hit.object;
    
    // 1. 세제함 분리 애니메이션
    const orchestrator = getPanelDrawerServiceOrchestrator();
    orchestrator.handleDrawerClick(clickedObject);
}
```
- **트리거 조건**: 일반 클릭 (Shift/Ctrl 미포함)
- **동작**: `PanelDrawerServiceOrchestrator` 싱글톤 인스턴스获取 및 `handleDrawerClick()` 호출
### 2단계 - PanelDrawerServiceOrchestrator (노드 검증)
```typescript
// src/services/orchestration/PanelDrawerServiceOrchestrator.ts
public handleDrawerClick(clickedObject: THREE.Object3D): boolean {
    // 세제함 노드 이름 추출
    const { assembly: drawerAssemblyName, drawer: drawerName } = 
        this.panelDrawerAnimationService.getDrawerNodeNames();

    // 클릭된 객체 또는 부모 중에 drawerName이 있는지 확인
    let current: THREE.Object3D | null = clickedObject;
    let isDrawer = false;
    
    while (current) {
        if ((drawerName && current.name === drawerName) || 
            (drawerAssemblyName && current.name === drawerAssemblyName)) {
            isDrawer = true;
            break;
        }
        current = current.parent;
    }

    if (isDrawer) {
        this.panelDrawerAnimationService.toggleDrawer();
        return true;
    }
    return false;
** ( **노드 이름}
```
- 메타데이터 기준):
	- `drawerAssembly`: `1D1M02_Panel_Drawer`
	- `drawer`: `1D1M04_Drawer`
	- **검증 방식**: 클릭된 객체의 부모 체인 순회 (Hierarchical Search)
### 3단계 - PanelDrawerAnimationService.toggleDrawer())
```typescript
 (토글 결정// src/services/animation/PanelDrawerAnimationService.ts
public async toggleDrawer(): Promise<void> {
    if (this.isDisassembled) {
        await this.assembleDrawer();  // 세제함을 원래 위치로 복구
    } else {
        await this.disassembleDrawer();  // 세제함을 당겨서 분리
    }
}
```
- **상태 플래그**: `isDisassembled` (초기값: `false`)
- **동작**: 분해 ↔ 조립 상태 토글
### 4단계 - disassembleDrawer() (분리 애니메이션)
### 4-1 메타데이터 설정 로드
```typescript
// washing-metadata.json
{
    "panelDrawerAnimations": {
        "drawerPullOut": {
            "direction": { "x": 0, "y": -1, "z": 0 },  //下方方向
            "pullDistance": 500,     // 500단위 이동
            "duration": 1500,        // 1500ms (1.5초)
            "easing": "power2.out"  // 감속 이징
        }
    }
}
```
### 4-2 노드 탐색 및 위치 저장
```typescript
const targetNodeNames = [drawerAssemblyName, drawerName];
const targetNodes: THREE.Object3D[] = [];

targetNodeNames.forEach(name => {
    const node = this.sceneRoot!.getObjectByName(name);
    if (node) targetNodes.push(node);
});

// 원래 위치 저장 (복구용)
if (this.originalPositions.size === 0) {
    targetNodes.forEach(node => {
        this.originalPositions.set(node.name, node.position.clone());
    });
}
```
### 4-3 GSAP 타임라인 생성 및 애니메이션
```typescript
this.timeline = gsap.timeline({
    onStart: () => { console.log('세제함 분리 애니메이션 시작'); },
    onComplete: () => { 
        console.log('세제함 분리 완료');
        this.isDisassembled = true;
        resolve();
    }
});

targetNodes.forEach(node => {
    // 이동 방향 및 거리 계산
    const direction = metadataDirection.clone();  // (0, -1, 0)
    const offset = direction.multiplyScalar(pullDistance);  // (0, -500, 0)
    
    // 로컬 좌표를 월드 좌표로 변환
    node.updateMatrixWorld();
    const worldTargetPosition = node.localToWorld(offset.clone());
    
    // 부모 기준 로컬 좌표로 다시 변환
    const localTargetPosition = worldTargetPosition.clone();
    if (node.parent) {
        node.parent.updateMatrixWorld();
        node.parent.worldToLocal(localTargetPosition);
    }

    // GSAP 애니메이션 등록
    this.timeline!.to(node.position, {
        x: localTargetPosition.x,
        y: localTargetPosition.y,
        z: localTargetPosition.z,
        duration: duration / 1000,  // 1.5초
        ease: metadataEasing        // power2.out
    }, 0);  // 동시에 시작
});
```
### 5단계 - assembleDrawer() (복구 애니메이션)
```typescript
// src/services/animation/PanelDrawerAnimationService.ts:221-284
public async assembleDrawer(): Promise<void> {
    this.timeline = gsap.timeline({
        onStart: () => { console.log('세제함 조립 애니메이션 시작'); },
        onComplete: () => { 
            console.log('세제함 조립 완료');
            this.isDisassembled = false;
            resolve();
        }
    });

    targetNodes.forEach(node => {
        const originalPos = this.originalPositions.get(node.name);
        if (originalPos) {
            this.timeline!.to(node.position, {
                x: originalPos.x,
                y: originalPos.y,
                z: originalPos.z,
                duration: duration / 1000,
                ease: metadataEasing
            }, 0);
        }
    });
}
```
## 4. 핵심 코드 포인트
### 4.1 좌표 변환 로직
- 분리 애니메이션에서 가장 중요한 부분은 **로컬 좌표 → 월드 좌표 → 부모 기준 로컬 좌표** 변환이다:
```typescript
// 1. 현재 노드의 월드 매트릭스 업데이트
node.updateMatrixWorld();

// 2. 로컬 오프셋을 월드 좌표로 변환
const worldTargetPosition = node.localToWorld(offset.clone());

// 3. 부모 노드의 월드 좌표계로 변환 (애니메이션용)
const localTargetPosition = worldTargetPosition.clone();
if (node.parent) {
    node.parent.updateMatrixWorld();
    node.parent.worldToLocal(localTargetPosition);
}
```
- **이유**: `node.position`은 부모 기준 로컬 좌표이므로, 방향 벡터를 적용하려면 먼저 월드 좌표로 변환 후 다시 로컬 좌표로 변환해야 한다.
### 4.2 동시 이동 (병렬 애니메이션)
- `drawerAssembly`와 `drawer` 두 노드를 **동시에** 이동시키기 위해 GSAP 타임라인의 세 번째 파라미터에 `0`을 전달:
```typescript
this.timeline!.to(node.position, { ... }, 0);  // 0 =同一タイムラインで同時に開始
```
## 5. 데이터 흐름 요약
```
[사용자 클릭]
     │
     ▼
┌──────────────────────────────┐
│ SelectionHandler            │
│  - handleDefaultClick()      │
└──────────────────────────────┘
     │
     ▼
┌──────────────────────────────┐
│ PanelDrawerServiceOrchestrator │
│  - handleDrawerClick()      │
│  - 노드 검증 (부모 체인)      │
└──────────────────────────────┘
     │
     ▼
┌──────────────────────────────┐
│ PanelDrawerAnimationService │
│  - toggleDrawer()           │
│  - isDisassembled 플래그 확인 │
└──────────────────────────────┘
     │
     ├── 분리 ──► disassembleDrawer()
     │                │
     │                ├── 메타데이터 로드
     │                ├── 노드 탐색
     │                ├── 원위치 저장
     │                └── GSAP 타임라인
     │
     └── 복구 ──► assembleDrawer()
                  │
                  ├── 원위치 참조
                  └── GSAP 타임라인
```
## 6. 의존성 관계
| 파일                                  | 역할                        | 의존성                                             |
| ----------------------------------- | ------------------------- | ----------------------------------------------- |
| `SelectionHandler.ts`               | 클릭 이벤트 처리 (진입점)           | `PanelDrawerServiceOrchestrator`                |
| `PanelDrawerServiceOrchestrator.ts` | 노드 검증 및 애니메이션 트리거         | `PanelDrawerAnimationService`, `MetadataLoader` |
| `PanelDrawerAnimationService.ts`    | 실제 애니메이션 실행               | `GSAP`, `MetadataLoader`, `NodeNameLoader`      |
| `washing-metadata.json`             | 애니메이션 설정 (방향, 거리, 시간, 이징) | -                                               |
| `node-names.json`                   | 노드 이름 매핑                  | -                                               |

