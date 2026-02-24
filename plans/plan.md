# 드럼 세탁기 세제함(Panel Drawer) 분리 애니메이션 구현 계획 (Plan)

## 1. 개요 및 목표
- 대상: `node-names.json` 상의 `drumWashing` > `panelDrawer` > `drawerAssembly` (`1D1M02_Panel_Drawer`)
- 목표: `fx_hp_disasm_drawer.webp` 애니메이션과 유사하게, 드럼 세탁기의 세제함을 직선 방향으로 당겨 분리하는 인터랙션(Animation) 코드를 프로젝트에 구현합니다.

## 2. 재사용 가능한 프로젝트 내 자산(Utilities & Patterns)
현재 프로젝트 코드를 분석한 결과, 아래와 같은 기능들을 재사용하여 구현하는 것이 가장 효율적입니다.
1. **노드 식별 (`NodeNameLoader.ts`)**
   - `NodeNameLoader.getInstance().getNodeName('drumWashing.panelDrawer.drawerAssembly')`를 사용하여 하드코딩 없이 세제함의 고유 Mesh 이름을 가져옵니다.
2. **GSAP 타임라인 애니메이션 (`gsap.timeline`)**
   - 프로젝트 전반(`DamperCoverAssemblyService`, `ScrewLinearMoveAnimationService` 등)에서 **GSAP**를 활용한 Three.js 객체 애니메이션(위치, 회전 이동)을 표준으로 사용 중입니다.
   - 선형 이동(Linear Move) 후 분리되는 동작은 GSAP의 `timeline`을 구성하여 순차적인 애니메이션(`gsap.to(node.position, {...})`)으로 구현합니다.
3. **카메라 애니메이션 유틸 (`animationUtils.ts`)**
   - 세제함을 당길 때 시선을 유도하기 위해 `animationUtils.ts`의 시네마틱 카메라 줌/이동 로직을 재사용하여 몰입감을 높입니다.
4. **로컬 좌표계 이동 (`CoordinateUtils.ts` 또는 오브젝트 로컬 축)**
   - 세제함이 부착된 각도에 상관없이 정확히 '앞'으로 당겨지도록, 노드의 로컬 Z축(또는 Y축) 기준으로 오프셋을 계산하여 이동시킵니다.

## 3. 단계별 구현 절차 (Implementation Steps)

### Step 1: `PanelDrawerAnimationService` 구조 설계
`src/services/animation/` (또는 `assembly/`) 폴더 하위에 `PanelDrawerAnimationService.ts` 클래스를 생성합니다. 기존 `DamperCaseBodyAnimationService`와 동일하게 `gsap`를 `import`하고, Scene Root를 주입받아 대상 노드를 제어하는 구조를 가집니다.

### Step 2: 분리(Disassemble) 메서드 구현
- **Mesh 탐색**: 주입받은 Scene Root에서 `NodeNameLoader`가 반환한 이름으로 세제함 Mesh(`1D1M02_Panel_Drawer`)를 찾습니다.
- **애니메이션 타임라인 구성**:
  1. **초기화**: 세제함의 현재 `position`을 저장합니다. (복구/조립을 위해)
  2. **1차 이동 (당기기)**: 세제함이 빠져나오는 방향(예: 로컬 Z축으로 +200 단위)으로 `gsap.to`를 사용해 이동시킵니다. Easing은 `power2.out` 등을 사용하여 자연스럽게 멈추도록 합니다.
  3. **2차 이동 (분리/숨김)**: 완전히 빠져나온 후 필요하다면 아래로 살짝 떨어지거나 투명도를 0으로 만들어(Material 렌더링 변경) 화면에서 사라지게(분리됨) 처리할 수 있습니다.

### Step 3: 이벤트 트리거 연동
UI 상의 "세제함 분리" 버튼 클릭 이벤트 핸들러 또는 3D 뷰포트 내 Click (Raycaster) 이벤트 시, 위에서 만든 `PanelDrawerAnimationService.disassemble()` 함수를 호출하여 애니메이션을 재생합니다.

## 4. 기대 효과 및 검증
- 기존 아키텍처(GSAP + NodeNameLoader)를 그대로 준수하여 코드 통일성 확보.
- 타임라인 기반 구현으로 추후 "조립(Assemble)" 역재생 기능을 쉽게 추가할 수 있음.
