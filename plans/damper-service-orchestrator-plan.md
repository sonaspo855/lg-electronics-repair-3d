# 댐퍼 서비스 오케스트레이터 분리 계획

## 1. 문제 분석

### 1.1 현재 구조의 문제점
- `AnimatorAgent.ts` 文件이 1,741줄로 매우 길어 유지보수가困难
- 1000-1250 라인의 댐퍼 서비스 시퀀스 코드가 `executeAnimationCommand` 메서드 내에硬코딩되어 있음
- 여러 애니메이션 단계가 하나의 메서드 내에서 직접 제어되므로 변경이 복잡
- 각 단계의 의존성이 명확하지 않아 디버깅이 어려움

### 1.2 분리의 필요성
- **단일 책임 원칙**: 댐퍼 서비스 시퀀스는 별도의 비즈니스 로직으로 분리해야 함
- **가독성 향상**: 각 단계를 명확한 메서드로 분리하면 코드의 이해가 쉬워짐
- **재사용성**: 다른 기능에서도 댐퍼 서비스 시퀀스를 재사용할 수 있음
- **테스트 용이성**: 분리된 오케스트레이터를 독립적으로 테스트할 수 있음

## 2. 설계 개념

### 2.1 오케스트레이터 패턴
댐퍼 서비스 시퀀스를 **파이프라인 기반의 오케스트레이터**로 설계
- 각 애니메이션 단계를 독립적인 작업(unit)으로 분리
- 단계 간 의존성과 실행 순서를 명시적으로 정의
- 오류 처리와 롤백 메커니즘을 중앙에서 관리

### 2.2 클래스 구조
```typescript
// 새로운 오케스트레이터 클래스
class DamperServiceOrchestrator {
  constructor(
    private cameraMovementService: CameraMovementService,
    private manualAssemblyManager: ManualAssemblyManager,
    private damperCaseBodyAnimationService: DamperCaseBodyAnimationService,
    private animationHistoryService: AnimationHistoryService,
    private nodeNameManager: NodeNameManager
  ) {}

  // 메인 실행 메서드
  async execute(commandsArray: AnimationCommand[]): Promise<void> {
    // 전체 시퀀스 실행
  }

  // 각 단계별 메서드
  private async moveCamera(): Promise<void> { ... }
  private async assembleDamperCover(): Promise<any> { ... }
  private async loosenScrews(): Promise<void> { ... }
  private async moveDamperCaseBody(): Promise<any> { ... }
  private async moveScrew2(): Promise<any> { ... }
  private async tightenScrews(): Promise<void> { ... }
  private async removeHolder(): Promise<any> { ... }
  private async restoreDamperCover(originalPosition: any): Promise<any> { ... }
  
  // 히스토리 기록 메서드
  private recordHistory(command: AnimationCommand, message: string): void { ... }
}
```

## 3. 구현 단계

### 3.1 단계 1: 오케스트레이터 클래스 생성
- `src/services/orchestration/` 폴더 생성
- `DamperServiceOrchestrator.ts` 파일 생성
- 필요한 서비스 의존성 주입 설정

### 3.2 단계 2: 각 애니메이션 단계 추출
- `moveCameraToLeftDoorDamper()` 메서드 추출
- `assembleDamperCover()` 메서드 추출
- `loosenScrews()` 메서드 추출 (스크류1, 스크류2 분리)
- `moveDamperCaseBody()` 메서드 추출
- `moveScrew2LinearToDamperCaseBody()` 메서드 추출
- `tightenScrews()` 메서드 추출 (스크류1, 스크류2 조립)
- `removeAssemblyNode()` 메서드 추출
- `restoreDamperCover()` 메서드 추출

### 3.3 단계 3: 시퀀스 제어 로직 구현
- 각 단계의 실행 순서 정의
- 오류 발생 시 롤백 메커니즘 구현
- 단계 간 데이터 전달 구조 설계

### 3.4 단계 4: AnimatorAgent.ts 수정
- 기존 1000-1250 라인의 코드 삭제
- DamperServiceOrchestrator 인스턴스 생성 및 의존성 주입
- isDamperCommands 조건에서 오케스트레이터 호출

### 3.5 단계 5: 테스트 및 검증
- 단위 테스트 작성 (각 단계별)
- 통합 테스트 작성 (전체 시퀀스)
- 실제 3D 모델에서의 동작 검증

## 4. 장점

### 4.1 유지보수성 향상
- 각 단계가 독립된 메서드로 분리되어 변경이 용이
- 코드의 의도가 명확하게 드러남
- 버그 추적과 디버깅이 간편

### 4.2 확장성
- 새로운 단계를 쉽게 추가할 수 있음
- 기존 단계의 수정이 다른 부분에 영향을 미치지 않음
- 다양한 댐퍼 서비스 시퀀스 변형을 지원

### 4.3 재사용성
- 오케스트레이터를 다른 기능에서 재사용할 수 있음
- 각 단계 메서드를 독립적으로 호출할 수 있음

### 4.4 테스트 용이성
- 각 단계를 독립적으로 테스트할 수 있음
- 모의(mock) 객체를 사용한 단위 테스트 작성이 쉬움

## 5. 주의 사항

### 5.1 의존성 관리
- 각 서비스의 의존성을 명시적으로 주입해야 함
- 서비스 간의 결합도를 최소화해야 함

### 5.2 오류 처리
- 각 단계에서의 오류를 적절히 처리해야 함
- 실패한 경우 롤백 또는 복구 메커니즘을 고려해야 함

### 5.3 성능
- 비동기 실행 순서를 효율적으로 관리해야 함
- 불필요한 지연을 최소화해야 함

## 6. 파일 구조 변경

### 6.1 새로운 파일
- `src/services/orchestration/DamperServiceOrchestrator.ts` - 댐퍼 서비스 오케스트레이터

### 6.2 수정된 파일
- `src/services/core/AnimatorAgent.ts` - 댐퍼 서비스 시퀀스 코드 제거 및 오케스트레이터 호출

## 7. 예상 결과

분리 완료 후 `AnimatorAgent.ts` 파일의 길이가 크게 줄어들고,
댐퍼 서비스 시퀀스가 명확한 구조로 표현됩니다.
각 단계의 책임이 분리되어 유지보수가 쉬워지고,
테스트와 확장이 용이해집니다.
