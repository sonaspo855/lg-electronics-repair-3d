# 내부/외부 필터 분리 애니메이션 구현 계획

## 1. 개요
`plateTopIntExtFilter` 노드(외부 필터: BRep_1_212, 내부 필터: BRep_1_210)를 대상으로 하는 분리/조립 애니메이션을 구현합니다. 프로젝트의 기존 애니메이션 서비스 패턴(PanelDrawerAnimationService 등)을 따르며, 공통 유틸리티와 메타데이터 관리 방식을 재사용합니다.

## 2. 주요 파일 및 컨텍스트

### 메타데이터 변경
- `public/metadata/node-names.json`: `plateTopIntExtFilter` 속성 확인 완료.
- `public/metadata/washing-metadata.json`: 필터 애니메이션 설정 추가.

### 신규 파일
- `src/services/animation/FilterAnimationService.ts`: 필터 애니메이션 로직 담당 (GSAP 활용).
- `src/services/orchestration/FilterServiceOrchestrator.ts`: 클릭 이벤트와 애니메이션 서비스 연결.

### 수정 파일
- `src/services/detection/SelectionHandler.ts`: 필터 클릭 핸들러 등록.

## 3. 구현 단계

### 단계 1: 메타데이터 설정
`washing-metadata.json`에 필터 이동 방향 및 거리 정보를 추가합니다.
```json
"filterAnimations": {
    "externalFilter": {
        "direction": { "x": 0, "y": 0, "z": 1 },
        "pullDistance": 300,
        "duration": 1000,
        "easing": "power2.out"
    },
    "internalFilter": {
        "direction": { "x": 0, "y": 0, "z": 1 },
        "pullDistance": 300,
        "duration": 1000,
        "easing": "power2.out"
    }
}
```

### 단계 2: FilterAnimationService 구현
- `PanelDrawerAnimationService`를 참고하여 싱글톤 클래스로 구현합니다.
- `toggleFilters()`, `disassembleFilters()`, `assembleFilters()` 메서드를 제공합니다.
- GSAP Timeline을 사용하여 외부 필터 이동 후 내부 필터가 이동하는 시퀀스를 구성합니다.

### 단계 3: FilterServiceOrchestrator 구현
- 클릭된 객체가 필터 노드(`BRep_1_212` 또는 `BRep_1_210`)인지 확인합니다.
- `FilterAnimationService`를 호출하여 애니메이션을 실행합니다.

### 단계 4: SelectionHandler 통합
- `handleDefaultClick` 메서드에서 `FilterServiceOrchestrator`를 호출하도록 수정합니다.

## 4. 검증 및 테스트
- 필터 노드 클릭 시 외부 필터가 먼저 빠져나오고 이어서 내부 필터가 분리되는지 확인합니다.
- 다시 클릭 시 역순으로 조립되는지 확인합니다.
- 애니메이션 도중 중복 클릭 방지 및 상태 관리(isDisassembled)를 검증합니다.
