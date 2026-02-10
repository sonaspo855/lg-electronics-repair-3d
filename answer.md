`ScrewLinearMoveAnimationService.ts` 파일의 `animateScrewLinearMove` 및 `animateScrewLinearMoveToDamperCaseBody` 함수에 스크류 머리 중심점으로부터 아래 방향으로 선을 시각화하는 코드를 추가하였습니다.

주요 변경 사항:
1. `CoordinateTransformUtils` 및 `getAssemblyPathVisualizer` 임포트 추가.
2. 애니메이션 시작 전 `CoordinateTransformUtils.getWorldCenter(screwNode)`를 사용하여 스크류의 월드 중심 좌표를 획득.
3. `AssemblyPathVisualizer`를 초기화하고, 중심 좌표에서 Y축 음의 방향(-0.1m)으로 선을 그리도록 구현.

```typescript
// [추가된 시각화 코드 예시]
const screwCenter = CoordinateTransformUtils.getWorldCenter(screwNode);
const visualizer = getAssemblyPathVisualizer();
visualizer.initialize(this.sceneRoot);

// "아래로" 선 그리기 (예: -0.1m 오프셋)
const downwardPoint = screwCenter.clone().add(new THREE.Vector3(0, -0.1, 0));
visualizer.visualizeAssemblyPath(screwCenter, downwardPoint);
```
