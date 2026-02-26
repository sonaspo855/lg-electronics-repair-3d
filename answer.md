# PanelDrawerServiceOrchestrator.ts 사용되지 않는 함수 분석

## 함수별 사용 여부

| 함수명 | 사용 여부 | 비고 |
|--------|----------|------|
| `getPanelDrawerServiceOrchestrator()` | ✅ 사용 중 | SelectionHandler.ts에서 호출 |
| `handleDrawerClick()` | ✅ 사용 중 | SelectionHandler.ts의 handleDefaultClick에서 간접 호출 |

---

## ❌ 사용되지 않는 함수

### 1. `getDrawerNodeNames()`
```typescript
public getDrawerNodeNames(): { assembly: string | null; drawer: string | null } {
    return this.panelDrawerAnimationService.getDrawerNodeNames();
}
```
- **이유**: `handleDrawerClick()` 메서드 내부에서 이미 사용되고 있어 외부에서 별도로 호출할 필요가 없음

### 2. `setSceneRoot()`
```typescript
public setSceneRoot(sceneRoot: THREE.Object3D): void {
    this.panelDrawerAnimationService.setSceneRoot(sceneRoot);
}
```
- **이유**: 현재 SelectionHandler에서 sceneRoot를 직접 PanelDrawerAnimationService에 설정하는 코드가 없음

### 3. `resetState()`
```typescript
public resetState(): void {
    this.panelDrawerAnimationService.resetState();
}
```
- **이유**: 서비스 상태 초기화 로직이 현재 호출되지 않음

---

## 권장 사항

현재 프로젝트에서 `setSceneRoot()`와 `resetState()`가 호출되지 않는 이유는 `PanelDrawerAnimationService`가 Singleton으로 작동하기 때문입니다. 

만약 이 함수들이 나중에 필요하다면:
1. `ManualEditorPage.tsx` 또는 모델 초기화 시 `setSceneRoot()` 호출 필요
2. 모델 변경 시 `resetState()` 호출 필요

 atau

단순화하고 싶다면 `PanelDrawerServiceOrchestrator`를 제거하고 [`SelectionHandler.ts`](src/services/detection/SelectionHandler.ts:1)에서 직접 [`PanelDrawerAnimationService`](src/services/animation/PanelDrawerAnimationService.ts:1)를 사용해도 됩니다.
