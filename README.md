# LG Electronics 3D Repair Manual Studio
LG 전자 제품의 3D 조립/분해 매뉴얼을 생성하고 관리하는 웹 애플리케이션입니다. 사용자는 AI 채팅 인터페이스를 통해 자연어로 명령을 입력하면 3D 모델의 부품을 조작하고 애니메이션을 생성할 수 있습니다.
## 프로젝트 개요
- **기술 스택**: React + TypeScript + Vite
- **3D 렌더링**: React Three Fiber (@react-three/fiber) + Three.js
- **3D 유틸리티**: @react-three/drei
- **AI 통신**: Ollama (Phi3 모델)
- **애니메이션**: Three.js AnimationMixer + GSAP
## 전체 폴더 구조
```
lg-electronics-repair-3d/
├─ .agent/                          # AI 에이전트 설정
├─ .kilocode/                       # Kilocode 규칙 및 설정
├─ .windsurf/                       # Windsurf IDE 설정
├─ docs/                            # 프로젝트 문서
│  └─ DAMPER_ASSEMBLY_GUIDE.md     # 댐퍼 조립 가이드
├─ examples/                        # 예제 코드
│  ├─ damper-assembly-example.ts   # 댐퍼 조립 예제
│  ├─ hole-detection-example.ts    # 구멍 탐지 예제
│  ├─ model-viewer-integration.ts  # 모델 뷰어 통합 예제
│  └─ README-hole-detection.md     # 구멍 탐지 README
├─ plans/                           # 기획 및 설계 문서
│  ├─ assembly-method-recommendation.md  # 조립 방식 추천
│  ├─ damper-assembly-analysis.md        # 댐퍼 조립 분석
│  ├─ damper-assembly-animation-architecture.md # 댐퍼 애니메이션 아키텍처
│  ├─ damper-cover-assembly-analysis.md  # 댐퍼 커버 조립 분석
│  ├─ damper-cover-assembly-plan.md      # 댐퍼 커버 조립 계획
│  ├─ groove-center-detection-plan.md    # 그루브 중심 탐지 계획
│  ├─ slot-insertion-assembly-plan.md    # 슬롯 삽입 조립 계획
│  ├─ virtual-pivot-assembly-plan.md     # 가상 피벗 조립 계획
│  ├─ plan.md                            # 폴더 구조 개선 결과
│  ├─ Services 및 Utils 폴더 구조 개선 실행 계획.md
│  └─ services-utils-restructuring-plan.md
├─ public/                          # 정적 리소스 폴더
│  ├─ metadata/                     # 메타데이터
│  │  ├─ assembly-offsets.json     # 조립 오프셋 설정
│  │  ├─ damper-animations.json    # 댐퍼 애니메이션 설정
│  │  └─ node-names.json           # 노드 이름 매핑
│  └─ models/                      # 3D 모델 파일 (GLB 포맷)
│     └─ M-Next3.glb              # 기본 냉장고 모델
├─ src/                            # 소스 코드 폴더
│  ├─ app/                         # 애플리케이션 엔트리
│  │  ├─ App.tsx                  # 메인 애플리케이션 컴포넌트
│  │  ├─ App.css                  # 앱 전역 스타일
│  │  └─ main.tsx                 # React 렌더링 엔트리
│  ├─ pages/                       # 페이지 컴포넌트
│  │  ├─ ManualEditorPage.tsx     # 3D 매뉴얼 에디터 페이지
│  │  ├─ AnimationLibraryPage.tsx # 애니메이션 라이브러리 페이지
│  │  └─ Projects.tsx             # 프로젝트 관리 페이지
│  ├─ components/                 # 재사용 가능한 컴포넌트
│  │  ├─ pages/                   # 페이지 전용 하위 컴포넌트
│  │  │  ├─ manual-editor/        # 매뉴얼 에디터 관련 컴포넌트
│  │  │  │  ├─ ActionLibraryPanel.tsx    # 액션 라이브러리 패널
│  │  │  │  ├─ AnimationHistoryPanel.tsx # 애니메이션 히스토리 패널
│  │  │  │  ├─ HierarchyPanel.tsx        # 노드 계층 패널
│  │  │  │  ├─ ManualEditorSidebar.tsx   # 에디터 사이드바
│  │  │  │  ├─ ActionLibraryPanel.css
│  │  │  │  ├─ AnimationHistoryPanel.css
│  │  │  │  ├─ HierarchyPanel.css
│  │  │  │  ├─ ManualEditorSidebar.css
│  │  │  │  └─ index.ts           # 컴포넌트 인덱스
│  │  │  └─ projects/             # 프로젝트 관리 관련 컴포넌트
│  │  │     ├─ ProjectsFrame.tsx  # 프로젝트 프레임
│  │  │     ├─ ProjectsHeader.tsx # 프로젝트 헤더
│  │  │     ├─ ProjectsTable.tsx  # 프로젝트 테이블
│  │  │     ├─ ProjectDetail.tsx  # 프로젝트 상세
│  │  │     ├─ types.ts           # 타입 정의
│  │  │     └─ index.ts
│  │  ├─ highlight/               # 하이라이트 관련 컴포넌트
│  │  │  ├─ NormalBasedHoleVisualizer.ts # 노멀 기반 홀 시각화
│  │  │  └─ index.ts
│  │  └─ shared/                  # 공용 컴포넌트
│  │     ├─ common/               # 범용 UI 컴포넌트
│  │     │  └─ index.ts
│  │     └─ viewer/               # 3D 모델 뷰어
│  │        ├─ ModelViewer.tsx    # 3D 모델 렌더링 컴포넌트
│  │        ├─ NodeHierarchy.tsx  # 노드 계층 구조 컴포넌트
│  │        ├─ ModelViewer.css
│  │        └─ index.ts
│  ├─ services/                   # 서비스 로직 (도메인별 분류)
│  │  ├─ core/                    # 핵심 서비스
│  │  │  ├─ AnimatorAgent.ts      # AI 애니메이터 에이전트
│  │  │  └─ AnimationHistoryService.ts # 애니메이션 히스토리 서비스
│  │  ├─ camera/                  # 카메라 관련 서비스
│  │  │  └─ CameraMovementService.ts  # 카메라 이동 서비스
│  │  ├─ assembly/                # 조립/분해 비즈니스 로직
│  │  │  ├─ PartAssemblyService.ts    # 부품 조립 서비스
│  │  │  ├─ ManualAssemblyManager.ts  # 수동 조립 관리자
│  │  │  ├─ DamperAssemblyService.ts  # 댐퍼 조립 서비스
│  │  │  └─ DamperCoverAssemblyService.ts # 댐퍼 커버 조립 서비스
│  │  ├─ animation/               # 세부 부품 애니메이션 서비스
│  │  │  ├─ DamperAnimationService.ts # 댐퍼 애니메이션 서비스
│  │  │  ├─ DamperCaseBodyAnimationService.ts # 댐퍼 케이스 바디 애니메이션
│  │  │  ├─ ScrewAnimationService.ts  # 스크류 회전 애니메이션
│  │  │  └─ ScrewLinearMoveAnimationService.ts # 스크류 선형 이동
│  │  ├─ detection/               # 탐지 및 핸들링 로직
│  │  │  ├─ GrooveDetectionService.ts  # 홈 탐지 서비스
│  │  │  ├─ GrooveDetectionUtils.ts    # 홈 탐지 유틸리티
│  │  │  ├─ NodeHeightDetector.ts      # 노드 높이 탐지
│  │  │  ├─ SelectionHandler.ts        # 선택 핸들러
│  │  │  └─ SnapDetectionService.ts    # 스냅 탐지 서비스
│  │  ├─ visualization/           # 시각화 및 하이라이트 서비스
│  │  │  ├─ NormalBasedHighlightService.ts # 노멀 기반 하이라이트
│  │  │  ├─ AssemblyPathVisualizer.ts   # 조립 경로 시각화
│  │  │  ├─ StencilOutlineHighlight.ts # 스텐실 아웃라인 하이라이트
│  │  │  ├─ ClickPointMarker.ts        # 클릭 지점 마커
│  │  │  └─ DebugObjectManager.ts      # 디버그 객체 관리자
│  │  └─ data/                    # 데이터 로딩 및 상태 관리
│  │     ├─ MetadataLoader.ts          # 메타데이터 로더
│  │     ├─ NodeNameManager.ts         # 노드 이름 관리자
│  │     ├─ NodeNameLoader.ts          # 노드 이름 로더
│  │     ├─ HoleCenterManager.ts       # 홈 중심점 관리자
│  │     └─ AssemblyStateManager.ts    # 조립 상태 관리자
│  ├─ shared/                     # UI가 아닌 공용 코드
│  │  ├─ constants/               # 상수 정의
│  │  │  └─ fridgeConstants.ts    # 냉장고 상수 정의
│  │  ├─ types/                   # 타입 정의
│  │  │  └─ three-examples.d.ts   # Three.js 확장 타입
│  │  └─ utils/                   # 유틸리티 함수 (순수 함수만)
│  │     ├─ animationUtils.ts     # 애니메이션 유틸리티
│  │     ├─ commonUtils.ts        # 일반적인 유틸리티 함수
│  │     ├─ coordinateUtils.ts    # 좌표 변환 유틸리티
│  │     ├─ highlightTreeNode.ts  # 트리 노드 하이라이트
│  │     ├─ isFastener.ts         # 나사/볼트 식별 유틸리티
│  │     ├─ removeClickedNode.ts  # 클릭한 노드 제거
│  │     └─ screwAnimationUtils.ts # 스크류 애니메이션 유틸리티
│  └─ styles/                     # 전역 스타일
│     └─ index.css                # 전역 CSS
├─ package.json                   # 프로젝트 의존성
├─ tsconfig.json                  # TypeScript 설정
├─ tsconfig.app.json              # Vite 앱 TypeScript 설정
├─ tsconfig.node.json             # Node TypeScript 설정
├─ vite.config.ts                 # Vite 설정
├─ CONVENTION.md                  # 개발 컨벤션
└─ index.html                     # HTML 엔트리

```
## 폴더 역할 상세 설명
### 1. public/
- **models/**: 3D 모델 파일 (GLB 포맷)
  - `M-Next3.glb`: 기본으로 로드되는 냉장고 3D 모델
- **metadata/**: 메타데이터 설정
  - `assembly-offsets.json`: 조립 오프셋 설정 파일
  - `damper-animations.json`: 댐퍼 애니메이션 설정
  - `node-names.json`: 노드 이름 매핑
### 2. src/app/
애플리케이션의 전체 구조와 라우팅을 관리합니다.
- **App.tsx**: 메인 애플리케이션 컴포넌트, 페이지 전환 및 상태 관리
- **App.css**: 앱 전역 스타일
- **main.tsx**: React 애플리케이션의 진입점
### 3. src/pages/
각 페이지에 해당하는 컴포넌트를 포함합니다.
- **ManualEditorPage.tsx**: 3D 매뉴얼 에디터 페이지
  - AI 채팅 인터페이스로 애니메이션 생성
  - 타임라인으로 애니메이션 관리
  - GLB 파일로 애니메이션 내보내기
- **AnimationLibraryPage.tsx**: 애니메이션 라이브러리 페이지
- **Projects.tsx**: 프로젝트 관리 페이지
### 4. src/components/
재사용 가능한 React 컴포넌트를 관리합니다.
#### 4.1 pages/
각 페이지 전용으로 사용되는 하위 컴포넌트
- **manual-editor/**: 매뉴얼 에디터 페이지 컴포넌트
  - `ActionLibraryPanel.tsx`: 액션 라이브러리 패널 (사전 정의된 애니메이션 목록)
  - `AnimationHistoryPanel.tsx`: 애니메이션 히스토리 패널 (생성된 애니메이션 관리)
  - `HierarchyPanel.tsx`: 노드 계층 패널 (3D 모델의 구조 표시)
  - `ManualEditorSidebar.tsx`: 에디터 사이드바 (파일 메뉴, 속성 관리)
  - 각 컴포넌트별 CSS 스타일 파일 포함
  - `index.ts`: 컴포넌트 인덱스 파일
- **projects/**: 프로젝트 관리 페이지 컴포넌트
  - `ProjectsFrame.tsx`: 프로젝트 프레임 (전체 레이아웃)
  - `ProjectsHeader.tsx`: 프로젝트 헤더 (타이틀, 액션 버튼)
  - `ProjectsTable.tsx`: 프로젝트 테이블 (목록 표시)
  - `ProjectDetail.tsx`: 프로젝트 상세 정보
  - `types.ts`: 프로젝트 관련 타입 정의
#### 4.2 highlight/
하이라이트 관련 컴포넌트
- **NormalBasedHoleVisualizer.ts**: 노멀 기반 홀 시각화 컴포넌트
#### 4.3 shared/
여러 페이지에서 공용으로 사용되는 컴포넌트
- **common/**: 범용 UI 컴포넌트 (버튼, 입력 필드 등)
- **viewer/**: 3D 모델 뷰어 관련 컴포넌트
  - `ModelViewer.tsx`: 3D 모델 렌더링 컴포넌트
  - `NodeHierarchy.tsx`: 3D 모델의 노드 계층 구조 컴포넌트
### 5. src/services/ (도메인별 분류)
비즈니스 로직을 담당하는 클래스들로, 상태(state)를 가지며 싱글톤 패턴을 주로 사용합니다.
#### 5.1 core/ - 핵심 에이전트 및 히스토리 서비스
- **AnimatorAgent.ts**: AI 애니메이터 에이전트 - Ollama API로 AI와 통신하여 자연어 명령을 파싱하고 애니메이션을 생성합니다.
  - `OllamaClient 클래스`: Ollama API와 통신하는 클라이언트
    - `list()`: 사용 가능한 모델 목록 조회
    - `chat()`: 채팅 API 호출
  - `AnimatorAgent 클래스`: 메인 애니메이터 에이전트
    - `setDoorControls()`: 도어 컨트롤 설정
    - `setCameraControls()`: 카메라 컨트롤 설정
    - `setOnActionCompleted()`: 액션 완료 콜백 설정
    - `processUserInput()`: 사용자 입력 처리 (메인 메서드)
    - `resetConversation()`: 대화 상태 초기화
    - `resetDoors()`: 모든 도어 상태 초기화
- **AnimationHistoryService.ts**: 애니메이션 히스토리 서비스 - 애니메이션 히스토리를 저장/불러오고 실행 취소/다시 실행 기능을 제공합니다.
  - `addAnimationHistory()`: 애니메이션 히스토리 추가
  - `getAllHistory()`: 전체 히스토리 반환
  - `clearHistory()`: 히스토리 초기화
  - `removeHistoryItem()`: 특정 히스토리 항목 제거
  - `reorderHistory()`: 히스토리 순서 재정렬
  - `exportToJson()`: JSON으로 내보내기
  - `importFromJson()`: JSON에서 가져오기
#### 5.2 camera/ - 카메라 관련 서비스
- **CameraMovementService.ts**: 카메라 이동 서비스 - 시네마틱 카메라 워킹을 구현합니다.
  - `setSceneRoot()`: 씬 루트 설정
  - `setCameraControls()`: 카메라 컨트롤 설정
  - `moveCameraToLeftDoorDamper()`: 왼쪽 도어 댐퍼 노드로 카메라 이동
  - `moveCameraCinematic()`: 시네마틱 카메라 워킹 (직선 → 하강 → 로우 앵글)
#### 5.3 assembly/ - 조립/분해 비즈니스 로직
- **PartAssemblyService.ts**: 부품 조립 서비스 - GSAP Timeline을 활용한 정밀한 부품 조립/분해 애니메이션 관리합니다.
  - `animateLinearAssembly()`: 선형 조립 애니메이션
  - `prepareManualAssembly()`: 수동 조립 준비 (타임라인만 생성)
  - `updateManualProgress()`: 수동 진행률 업데이트
  - `assemblePart()`: 부품을 타겟 위치로 조립
  - `disassemblePart()`: 조립된 부품을 원래 위치로 분해
  - `pause()`, `resume()`, `reverse()`: 애니메이션 제어
  - `getProgress()`: 현재 진행률 반환
  - `movePartRelative()`: 특정 노드를 현재 위치에서 상대적으로 이동

- **ManualAssemblyManager.ts**: 수동 조립 관리자 - 조립/분해 관련 함수를 중앙 집중식 관리합니다.
  - `disassembleDamperCover()`: 댐퍼 커버 분해
  - `getProgress()`: 진행률 반환
  - `isPlaying()`: 재생 중인지 확인
  - `getHoleCenters()`: 홈 중심점 정보 반환
  - `detectAndHighlightGrooves()`: 노드의 면 하이라이트 및 홈 탐지
  - `assembleDamperCover()`: 댐퍼 돌출부/홈 결합
  - `removeAssemblyNode()`: assemblyNode 제거
  - `loosenScrew()`, `tightenScrew()`: 스크류 애니메이션

- **DamperAssemblyService.ts**: 댐퍼 조립 서비스 - 디버깅용 노드 구조 출력 기능을 제공합니다.
  - `initialize()`: 서비스 초기화
  - `clearHighlights()`: 하이라이트 제거
  - `debugPrintDamperStructure()`: Damper Assembly와 Cover의 노드 구조 출력

- **DamperCoverAssemblyService.ts**: 댐퍼 커버 조립 서비스 - 댐퍼 커버 조립 로직을 담당합니다.
  - `assembleDamperCover()`: 댐퍼 돌출부/홈 결합
  - `getDetectedPlugs()`: 탐지된 돌출부(Plug) 정보 반환
  - `filterDuplicatePlugs()`: 탐지된 돌출부 중 너무 가까운 것들을 필터링
  - `removeAssemblyNode()`: assemblyNode를 3단계 애니메이션으로 제거

#### 5.4 animation/ - 세부 부품 애니메이션 서비스
- **DamperAnimationService.ts**: 댐퍼 애니메이션 서비스 - 댐퍼 서비스 명령을 생성하고 처리합니다.
  - `getFridgeDamperAnimationCommands()`: 댐퍼 애니메이션 명령 반환
  - `areFridgeDamperCommands()`: 댐퍼 명령인지 확인
  - `isFridgeDamperCommand()`: 입력에 댐퍼 키워드 포함 여부 확인

- **DamperCaseBodyAnimationService.ts**: 댐퍼 케이스 바디 애니메이션 서비스 - 댐퍼 케이스 바디의 선형 이동 애니메이션을 관리합니다.
  - `animateDamperCaseBodyLinearMove()`: 댐퍼 케이스 바디 선형 이동 애니메이션 실행
  - `getDamperCaseBodyNodeName()`: 댐퍼 케이스 바디 노드 이름 가져오기
  - `getAnimationConfig()`: 애니메이션 설정 가져오기
  - `getAnimationStages()`: 애니메이션 스테이지 정보 가져오기

- **ScrewAnimationService.ts**: 스크류 애니메이션 서비스 - 스크류를 돌려서 빼는 애니메이션을 담당합니다.
  - `isScrewNode()`: 스크류 노드인지 확인
  - `animateScrewRotation()`: 스크류 회전+이동 동시 애니메이션 (분해용)
  - `animateScrewRotationReverse()`: 스크류 회전+이동 역방향 애니메이션 (조립용)
  - `pause()`, `resume()`, `reverse()`: 애니메이션 제어

- **ScrewLinearMoveAnimationService.ts**: 스크류 선형 이동 애니메이션 서비스 - 스크류의 선형 이동을 담당합니다.
  - 스크류 노드를 특정 방향으로 선형 이동
  - 원래 위치로 되돌리기 기능
#### 5.5 detection/ - 탐지 및 핸들링 로직
- **GrooveDetectionService.ts**: 홈 탐지 서비스 - 노드의 면 하이라이트 및 홈 탐지를 담당합니다.
  - `detectAndHighlightGrooves()`: 노드의 면 하이라이트 및 홈 탐지
  - `getHoleCenters()`: 홈 중심점 정보 반환
  - `getHoleCenterById()`: ID로 홈 중심점 찾기
  - `getHoleCenterByIndex()`: 인덱스로 홈 중심점 찾기
  - `getHoleCentersCount()`: 홈 중심점 개수 반환
  - `clearHighlights()`: 모든 하이라이트 제거

- **GrooveDetectionUtils.ts**: 홈 탐지 유틸리티 - Normal 기반 그루브 탐지, 곡률 기반 돌출부 패턴 인식

- **NodeHeightDetector.ts**: 노드 높이 탐지 - 3D 모델 노드의 높이 계산
  - `highlightNode()`: 노드에 하이라이트 적용
  - `findNodeHeight()`: 노드의 높이를 찾고 하이라이트 (이름 기반)
  - `selectedNodeHeight()`: 선택된 노드의 높이를 찾아 하이라이트 (클릭 이벤트 기반)

- **SelectionHandler.ts**: 선택 핸들러 - 노드 선택 이벤트 처리

- **SnapDetectionService.ts**: 스냅 탐지 서비스 - 조립 시 스냅 위치 탐지

#### 5.6 visualization/ - 시각화 및 하이라이트 서비스
- **NormalBasedHighlightService.ts**: 노멀 기반 하이라이트 서비스 - 법선 벡터 기반 표면 특성 분석
  - `highlightFacesByNormalFilter()`: 법선 벡터 기반 필터링으로 하이라이트
  - `highlightFacesByCameraFilter()`: 카메라를 기준으로 정면 면 하이라이트
  - `highlightClusters()`: 탐지된 클러스터(홈 영역)들을 개별 색상으로 하이라이트
  - `calculateVirtualPivotByNormalAnalysis()`: 정점 법선 벡터 분석을 통한 가상 피벗 계산
  - `calculatePlugByEdgeAnalysis()`: 엣지 기반 돌출부(Plug) 탐지
  - `clearHighlights()`: 활성화된 모든 하이라이트 제거

- **AssemblyPathVisualizer.ts**: 조립 경로 시각화 관리자
  - `visualizeAssemblyPath()`: 조립 경로 시각화
  - `visualizeDetectedCoordinates()`: 탐지된 돌출부와 홈 좌표 시각화
  - `clearDebugObjects()`: 모든 디버그 객체 제거

- **StencilOutlineHighlight.ts**: 스텐실 아웃라인 하이라이트 - 외곽선 강조 효과

- **ClickPointMarker.ts**: 클릭 지점 마커 - 클릭한 위치에 시각적 마커 표시

- **DebugObjectManager.ts**: 디버그 객체 관리자
  - `createSphereMarker()`: 구체 마커 생성
  - `createLine()`, `createDashedLine()`: 라인 생성
  - `createArrowHelper()`: 화살표 헬퍼 생성
  - `clearDebugObjects()`: 모든 디버그 객체 제거

#### 5.7 data/ - 데이터 로딩 및 상태 관리
- **MetadataLoader.ts**: 메타데이터 로더
  - `loadMetadata()`: 메타데이터 파일 로딩
  - `getAssemblyConfig()`: 특정 어셈블리 설정 반환
  - `getInsertionOffset()`: 특정 어셈블리의 삽입 오프셋 반환
  - `getAnimationDuration()`: 애니메이션 Duration 반환
  - `getScrewAnimations()`: 스크류 애니메이션 설정 반환

- **NodeNameManager.ts**: 노드 이름 관리자
  - `enableMetadataMode()`: 메타데이터 사용 모드 활성화
  - `getNodeName()`: 노드 이름 가져오기 (점 표기법 지원)
  - `setNodeName()`: 노드 이름 설정 (런타임 동적 추가)
  - `getAllNodeNames()`: 모든 노드 이름 가져오기

- **NodeNameLoader.ts**: 노드 이름 로더
  - `loadNodeNames()`: 노드 이름 메타데이터 로드
  - `getNodeName()`: 노드 이름 가져오기
  - `isLoadedData()`: 로드 여부 확인

- **HoleCenterManager.ts**: 홈 중심점 관리자
  - `visualizeHoleCenters()`: 홈 중심점에 시각적 마커 표시
  - `getHoleCenters()`: 홈 중심점 정보 반환
  - `getHoleCenterById()`: ID로 홈 중심점 찾기
  - `clearHoleCenters()`: 모든 홈 중심점 정보 초기화

- **AssemblyStateManager.ts**: 조립 상태 관리자
  - `updateProgress()`: 조립 진행률 업데이트
  - `getProgress()`: 조립 진행률 반환
  - `startAssembly()`, `completeAssembly()`, `stopAssembly()`: 조립 상태 제어
  - `getState()`: 현재 상태 정보 반환

### 6. src/shared/
UI 컴포넌트가 아닌 공용 코드
#### 6.1 constants/
전역 상수 정의
- **fridgeConstants.ts**: 냉장고 모델 관련 상수 정의
#### 6.2 types/
TypeScript 타입 정의
- **three-examples.d.ts**: Three.js 확장 타입 정의
#### 6.3 utils/
순수 함수형 유틸리티와 헬퍼 함수들 (상태가 없는 stateless 함수들)
- **animationUtils.ts**: 애니메이션 관련 유틸리티
  - `CinematicSequence`: GSAP Timeline 기반 시네마틱 카메라 시퀀스 빌더
  - `calculateCameraTargetPosition()`: 바운딩 박스 기반 카메라 타겟 위치 계산
  - `createAnimationTimeline()`: 회전+이동 동시 애니메이션 생성

- **commonUtils.ts**: 일반적인 유틸리티 함수
  - `getPreciseBoundingBox()`: 정확한 바운딩 박스 계산
  - `debugFocusCamera()`: 카메라를 대상 박스로 포커스하는 애니메이션
  - `createHighlightMaterial()`: 하이라이트용 MeshBasicMaterial 생성
  - `getNodeHierarchy()`: Three.js 객체의 계층 구조 추출
  - `exportHierarchyToJson()`: 노드 계층 구조를 JSON 파일로 내보내기
  - `degreesToRadians()`: 각도를 도에서 라디안으로 변환

- **coordinateUtils.ts**: 좌표 변환 유틸리티 - 좌표계 변환 관련 함수들

- **highlightTreeNode.ts**: 트리 노드 하이라이트 처리 - UI 트리 노드 하이라이트

- **isFastener.ts**: 나사/볼트 노드 식별 유틸리티
  - `isFastenerNodeName()`: 노드 이름으로 나사/볼트인지 확인
  - `isFastenerNode()`: THREE.Object3D 노드가 나사/볼트인지 확인

- **removeClickedNode.ts**: 클릭한 노드 제거 유틸리티

- **screwAnimationUtils.ts**: 스크류 애니메이션 유틸리티
  - `calculateTranslationDistance()`: 스크류 이동 거리 계산
### 7. src/styles/
전역 스타일과 CSS 변수를 관리합니다.
- **index.css**: 전역 CSS 스타일 및 CSS 변수
## 주요 기능
### 1. 3D 모델 뷰어
- GLB 포맷의 3D 모델 로드 및 렌더링
- OrbitControls로 카메라 조작 (회전, 줌, 패닝)
- 모델의 노드 계층 구조 표시
- 스텐실 아웃라인 하이라이트
### 2. AI 채팅 인터페이스
- 자연어로 명령 입력 (예: "상단 왼쪽 문을 90도 열어")
- Ollama AI 모델로 명령 파싱
- 대화 상태 관리 (문맥 기반 응답)
### 3. 애니메이션 생성
- 문 열기/닫기 애니메이션
- 댐퍼 서비스 애니메이션 (동시에 두 개의 문 열기)
- 애니메이션 속도 및 각도 제어
- GSAP를 활용한 복잡한 이징 효과
### 4. 애니메이션 관리
- 타임라인으로 애니메이션 순서 관리
- 애니메이션 히스토리 저장 및 재사용
- GLB 파일로 애니메이션 내보내기
### 5. 프로젝트 관리
- 프로젝트 생성, 수정, 삭제
- 3D 모델 파일 관리
- 애니메이션 라이브러리 관리
### 6. 홈/그루브 탐지 및 돌출부 삽입
- Normal 기반 그루브 탐지
- Bounding Box 기반 정렬
- Metadata + Virtual Pivot 방식 지원
- 곡률 기반 돌출부 패턴 인식
### 7. 시네마틱 카메라 워킹
- Bezier 곡선 기반 부드러운 카메라 이동
- 대상 물체에 맞춰 동적 시점 계산
- GSAP를 활용한 복잡한 이징 효과
## 8. 프로젝트 문서
## 폴더 구조 개선 사항
### Services 폴더 도메인별 재구성
기존 `src/services/fridge/`에 혼재되어 있던 서비스들을 기능별로 세분화된 하위 폴더로 분산 배치했습니다:

| 폴더 | 설명 | 포함 서비스 |
|------|------|------------|
| `core/` | 핵심 에이전트 및 히스토리 | AnimatorAgent, AnimationHistoryService |
| `camera/` | 카메라 이동 관련 | CameraMovementService |
| `assembly/` | 조립/분해 비즈니스 로직 | PartAssemblyService, ManualAssemblyManager, DamperAssemblyService, DamperCoverAssemblyService |
| `animation/` | 세부 부품 애니메이션 | DamperAnimationService, DamperCaseBodyAnimationService, ScrewAnimationService, ScrewLinearMoveAnimationService |
| `detection/` | 탐지 및 핸들링 로직 | GrooveDetectionService, SnapDetectionService, SelectionHandler, NodeHeightDetector |
| `visualization/` | 시각화 및 하이라이트 | NormalBasedHighlightService, AssemblyPathVisualizer, StencilOutlineHighlight, ClickPointMarker, DebugObjectManager |
| `data/` | 데이터 로딩 및 상태 관리 | MetadataLoader, NodeNameManager, NodeNameLoader, HoleCenterManager, AssemblyStateManager |
### Shared 폴더 역할 명확화
- **constants/**: 상수 정의 (`fridgeConstants.ts`)
- **utils/**: 순수 유틸리티 함수만 유지 (서비스 클래스 제거)
### 클래스 및 파일명 개선
| 기존 이름 | 변경 후 이름 | 비고 |
|----------|-------------|------|
| `SnapDetectionUtils` | `SnapDetectionService` | 서비스 성격 명확화 |
| `NormalBasedHighlight` | `NormalBasedHighlightService` | 서비스 성격 명확화 |
| `findNodeHeight.ts` | `NodeHeightDetector.ts` | 역할 기반 명명 |
| `CoordinateTransformUtils` | `coordinateUtils` | 파일명과 일치 및 간결화 |
### 기대 효과
- **가독성**: 폴더 구조만으로 각 파일의 역할(Service vs Utils)과 도메인을 쉽게 파악
- **유지보수성**: 관련된 기능들이 응집력 있게 그룹화되어 수정 범위가 명확
- **확장성**: 새로운 기능 추가 시 명확한 배치 기준이 마련되어 구조적 일관성 유지
## 개발 컨벤션
- **Commit Convention**: Conventional Commits 사용
- **Import 규칙**: 페이지 컴포넌트는 `src/components/pages/<page>/index.ts`를 통해 가져옴
- **공용 컴포넌트**: `src/components/shared/<domain>/index.ts`를 통해 가져옴
- **서비스 분류**: 비즈니스 로직은 `src/services/` 하위 도메인 폴더에 배치
- **유틸리티 분류**: 순수 함수는 `src/shared/utils/`에 배치

## 실행 방법
### 1. 의존성 설치
```bash
npm install
```
### 2. 개발 서버 시작
```bash
npm run dev
```
서버는 http://localhost:3000에서 실행됩니다.
### 3. Ollama 서비스 실행
AI 기능을 사용하려면 Ollama 서비스가 실행 중이어야 합니다.
```bash
ollama serve
```
### 4. 빌드
```bash
npm run build
```
## 기술 특징
- **React Three Fiber**: Three.js를 React에서 선언적으로 사용
- **SkeletonUtils**: 3D 모델 클로닝
- **AnimationMixer**: Three.js의 애니메이션 시스템
- **GLTFExporter**: 3D 모델과 애니메이션을 GLB 파일로 내보내기
- **Ollama**: 로컬에서 실행되는 AI 모델
- **GSAP**: 복잡한 이징 효과 및 타임라인 제어
- **Normal-Based Detection**: 노멀 벡터 기반 표면 특성 분석
- **Bounding Box Optimization**: 정확한 월드 좌표 기반 바운딩 박스 계산
## 확장 가능성
- 새로운 제품 모델 추가
- 더 많은 애니메이션 타입 지원
- AI 모델 업그레이드 (Phi3 → Llama 3)
- 협업 기능 추가
- VR/AR 지원
