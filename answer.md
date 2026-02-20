`assembly-offsets.json` 파일의 각 속성에 대한 설명을 `description` 속성으로 추가했습니다.

## 추가된 설명 요약

### 최상위 레벨
- `versionDescription`: 메타데이터 파일의 버전 정보
- `lastUpdatedDescription`: 메타데이터 파일의 마지막 업데이트 일시

### assemblies 섹션
- `description`: 조립 관련 설정 섹션 설명
- `damper_cover_assembly.description`: 댐퍼 커버 조립 설정
- `targetNodeDescription`: 조립 대상 타겟 노드 (홈이 위치한 노드)
- `partNodeDescription`: 조립할 부품 노드 (돌출부가 위치한 노드)

### grooveDetection (홈 탐지 설정)
- `methodDescription`: 홈 탐지 방식 설명
- `innerBoundRatioDescription`: 홈 내부 경계 비율
- `normalFilter.*Description`: 법선 벡터 기준 방향 설명
- `normalToleranceDescription`: 법선 벡터 허용 오차
- `plugSearchDirection.*Description`: 돌출부 탐색 방향
- `edgeAngleThresholdDescription`: 엣지 각도 임계값
- `plugClusteringDistanceDescription`: 돌출부 클러스터링 거리
- `holeClusteringDistanceDescription`: 홈 클러스터링 거리
- `maxVerticesThresholdDescription`: 최대 정점 수 임계값
- `durationDescription`: 애니메이션 지속 시간

### insertion (삽입 설정)
- `offset.*Description`: 삽입 위치 오프셋 (미터 단위)
- `distanceReductionDescription`: 거리 축소값
- `depthDescription`: 삽입 깊이 비율
- `rotationOffset.*Description`: 회전 오프셋 (라디안)

### disassembly (분해 설정)
- `liftDistanceDescription`: 들어올리는 거리
- `slideDistanceDescription`: 미끄러지는 거리
- `tiltAngleDescription`: 기울이는 각도
- `liftDurationDescription`: 들어올리기 애니메이션 시간
- `slideDurationDescription`: 미끄러지기 애니메이션 시간
- `fadeDurationDescription`: 페이드 아웃 시간

### screwAnimations 섹션
- `rotationAxisDescription`: 회전 축
- `rotationAngleDescription`: 회전 각도 (도 단위)
- `extractDirectionDescription`: 추출 방향 벡터
- `extractDistanceDescription`: 추출 거리 (mm 단위)
- `screwPitchDescription`: 스크류 피치
- `durationDescription`: 애니메이션 지속 시간
- `easingDescription`: 이징 함수

### damperCaseBodyAnimations 섹션
- `methodDescription`: 이동 방식
- `targetScrewNodeDescription`: 기준 스크류 노드
- `offset.*Description`: 이동 오프셋

### screwLinearMovements 섹션
- `pivot.*Description`: 피벗 포인트 좌표
- `offset.*Description`: 이동 오프셋

### cameraSettings 섹션
- `durationDescription`: 카메라 이동 시간
- `easingDescription`: 이징 함수
- `distanceDescription`: 카메라-타겟 거리 (미터)
- `direction.*Description`: 카메라 방향 벡터
- `distanceNote`, `directionNote`: 추가 설명 노트
