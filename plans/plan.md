# Plan: 댐퍼 커버 본래 위치 복구 애니메이션 구현

## 개요
`AnimatorAgent.ts`에서 댐퍼 커버 조립 후 여러 작업이 완료된 시점에 `coverNode`를 다시 본래 위치(`originalPosition`)로 복구하는 애니메이션을 구현합니다. 기존의 `DamperCoverAssemblyService`와 `ManualAssemblyManager`를 확장하여 재사용 가능한 기능을 추가합니다.

## 상세 단계

### 1. `AnimationAction` 타입 추가
- `src/services/AnimatorAgent.ts`의 `AnimationAction` 상수에 `DAMPER_COVER_RESTORE: 'damper_cover_restore'`를 추가합니다.
- (선택 사항) `src/services/fridge/DamperAnimationService.ts`의 `AnimationAction`도 동기화합니다.

### 2. `DamperCoverAssemblyService` 기능 확장
- `src/services/fridge/DamperCoverAssemblyService.ts`에 `restoreDamperCover` 메서드를 추가합니다.
  - 매개변수: `originalPosition`, `options` (duration, onComplete 등)
  - 내용: GSAP를 사용하여 `coverNode`를 `originalPosition`으로 선형 이동시킵니다.

### 3. `ManualAssemblyManager` 기능 확장
- `src/services/fridge/ManualAssemblyManager.ts`에 `restoreDamperCover` 메서드를 추가하여 서비스를 호출할 수 있도록 합니다.
  - 매개변수: `originalPosition`, `options`
  - 반환값: 애니메이션 결과 정보 (히스토리 기록용)

### 4. `AnimatorAgent.ts` 로직 수정
- `assemblyResult` 변수의 선언 위치를 조정하여 하위 블록에서도 접근 가능하도록 합니다.
- line 1220 부근의 주석(`// coverNode 노드의 본래 위치로 복구하는 애니메이션`) 아래에 복구 애니메이션 실행 코드를 작성합니다.
  - `manualAssemblyManager.restoreDamperCover` 호출
  - `animationHistoryService`에 복구 작업 히스토리 기록

## 검증 계획
- 애니메이션 실행 후 `coverNode`가 정확히 `originalPosition`으로 복귀하는지 확인합니다.
- 콘솔 로그를 통해 애니메이션 히스토리에 `damper_cover_restore` 작업이 올바르게 기록되는지 확인합니다.
