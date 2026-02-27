# 내부/외부 필터 분리 애니메이션 구현 완료 보고서

## 1. 구현 개요
`plateTopIntExtFilter` 노드(외부 필터: BRep_1_212, 내부 필터: BRep_1_210)를 대상으로 한 순차적 분리 및 조립 애니메이션 구현을 완료하였습니다. 기존의 `PanelDrawerAnimationService` 패턴을 계승하여 일관성 있는 구조로 설계되었습니다.

---

## 2. 주요 변경 사항

### 2.1 메타데이터 설정 및 타입 정의
- **`public/metadata/washing-metadata.json`**: 외부/내부 필터의 이동 방향, 거리, 속도 설정을 추가했습니다.
- **`src/services/data/MetadataTypes.ts`**: `FilterAnimationConfig` 인터페이스를 추가하고 `AssemblyOffsetMetadata`에 포함시켰습니다.
- **`src/services/data/MetadataService.ts` & `MetadataLoader.ts`**: 메타데이터에서 필터 설정을 읽어오는 `getFilterAnimationConfig` 메서드를 구현했습니다.

### 2.2 애니메이션 서비스 구현
- **`src/services/animation/FilterAnimationService.ts`**: 
    - `[Common]` 드럼 세탁기 필터 분리 애니메이션 담당
    - **핸들 누르기 시퀀스**: 클릭 시 `DecorHandle` 노드가 안쪽으로 눌렸다가 돌아오는 동작을 선행 수행
    - **그룹 분리**: 핸들 동작 직후 `CoverAssembly`와 `CoverFilter` 노드(및 자식 노드)를 그룹화하여 동시에 분리 위치로 이동
    - 조립 시에는 커버 그룹이 먼저 복귀하고 핸들이 다시 한 번 눌리는 피드백 애니메이션 수행
    - `originalPositions`를 통해 모든 관련 노드의 정밀한 위치 복구 보장

### 2.3 오케스트레이터 및 이벤트 통합
- **`src/services/orchestration/FilterServiceOrchestrator.ts`**: 필터 노드 클릭 여부를 판별하고 애니메이션 서비스를 호출하는 로직을 담당합니다.
- **`src/services/detection/SelectionHandler.ts`**: `handleDefaultClick` 메서드 내에서 필터 클릭 체크를 최우선으로 수행하도록 통합했습니다.
- **`src/components/shared/viewer/ModelViewer.tsx`**: 모델 로드 시 `FilterAnimationService`가 현재 `sceneRoot`를 참조할 수 있도록 초기화 로직을 추가했습니다.

---

## 3. 사용 방법
1. 3D 모델에서 외부 필터(`BRep_1_212`) 또는 내부 필터(`BRep_1_210`) 영역을 클릭합니다.
2. **분리**: 외부 필터가 먼저 앞으로 나오고, 잠시 후 내부 필터가 따라 나오는 순차 애니메이션이 실행됩니다.
3. **조립**: 다시 필터 영역을 클릭하면 내부 필터가 먼저 들어가고, 외부 필터가 닫히는 역순 애니메이션이 실행됩니다.

---

## 4. 코드 스타일 준수 사항
- 모든 신규 함수 및 클래스에 `[Common]` 주석 및 역할 설명을 추가했습니다.
- 기존 프로젝트의 싱글톤 패턴 및 서비스/오케스트레이터 구조를 엄격히 준수했습니다.
- 가독성을 위해 애니메이션 로직을 `animateNode` 유틸리티 메서드로 분리하여 중복을 제거했습니다.
