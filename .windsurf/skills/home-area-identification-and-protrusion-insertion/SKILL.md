---
name: home-area-identification-and-protrusion-insertion
description: A brief description, shown to the model to help it understand when to use this skill
---

##  ■■ Description ■■
- **'홈(Hole/Groove) 영역 파악 및 돌출부 삽입'** 작업은 디지털 트윈 및 가상 조립 매뉴얼 구현에서 매우 높은 정밀도를 요구하는 작업이다.
### 1. Bounding Box & Offset 기반 (가장 빠르고 경제적)
- **방식:** 홈(Hole) 노드의 Bounding Box를 구한 뒤, 그 중심점(Center)을 타겟 좌표로 설정한다.
- **삽입 로직:** 돌출부 노드의 중심을 홈의 중심에 일치시키되, 모델링 데이터의 오프셋을 고려하여 한쪽 축(예: Z축)으로 미세하게 조정한다.
- **추천 상황:** 홈의 형상이 단순(사각형, 원형)하고 조립 정밀도가 아주 엄격하지 않을 때 적합하다.
### 2. 더미 노드(Pivot/Socket) 활용 방식 (가장 안정적 - 강력 추천)
3D 모델링 단계(Blender, Max 등)에서 **홈의 정중앙에 'Socket' 역할을 하는 빈(Empty) 객체**를 미리 심어둔다.
- **방식:** 
	1. 홈 내부에 `socket_hole_01`이라는 이름의 더미 노드를 배치한다. 
	2. 2. 돌출부 끝단에는 `plug_pin_01`이라는 이름의 노드를 배치한다. 
	3. 3. 코드에서 두 노드의 **World Position과 Quaternion(회전값)** 을 일치시킨다.
- **추천 이유:** 셰이더나 기하학적 계산 없이도 완벽한 삽입 각도와 깊이를 보장합니다. 유지보수가 매우 쉽다.
### 3. OBB(Oriented Bounding Box) 기반 충돌 체크
객체가 기울어져 있을 때 일반적인 AABB(Axis-Aligned Bounding Box)는 오차가 발생한다. 이때는 회전된 박스 모델인 **OBB**를 사용해야 한다.
- **방식:** `three-mesh-bvh` 라이브러리를 사용하여 홈 내부의 빈 공간(Volume)을 계산하고, 돌출부의 메쉬가 해당 볼륨 안으로 진입했는지 체크한다.
- **추천 상황:** 사용자가 직접 마우스로 부품을 드래그해서 끼워 넣는 **인터랙티브 교육 콘텐츠**를 제작할 때 필수적이다.
## 4. 더미 노드(Pivot/Socket) 방식을 사용하려면 glb 내 더미 노드 존재 여부를 파악 해야 한다.
- 더미 노드(Pivot/Socket) 방식을 구현하기 위해서는 **GLB 파일 내에 해당 노드가 실제로 존재하는지, 그리고 이름(Name)이 규칙에 맞게 명명되었는지** 를 파악해야 한다.
### 4-1. 더미 노드란?
- **더미 노드(Dummy Node)** 는 화면에는 실제로 보이지 않지만, 
  **공간상의 특정 위치(Coordinate), 회전(Rotation), 크기(Scale) 정보를 가지고 있는 '빈 껍데기' 객체**를 의미한다.
### 4-2 왜 '더미(Dummy)'라고 부르나요?
- 실제 제품의 외형(Mesh)은 없기 때문이다. 
- 하지만 엔진상에서는 일반 부품과 똑같은 좌표계를 가지므로, 복잡한 계산을 대신해주는 **'좌표 저장소'** 혹은 **'길잡이'** 역할을 수행한다.
### 4-3. 더미 노드의 주요 역할
#### ① 조립 기준점 (Socket / Connector)
사용자께서 질문하신 "홈에 부품을 끼워 넣는 작업"에서 가장 핵심적인 역할입니다.
- **원리:** 홈(Hole)의 정중앙에 `Socket_Hole`이라는 이름의 더미 노드를 배치합니다.
- **효과:** 부품을 이동시킬 때 "홈의 입구가 어디지?"라고 계산할 필요 없이, 단순히 `Socket_Hole` 노드의 위치값으로 부품을 이동시키면 정확히 조립됩니다.
#### ② 회전축 설정 (Pivot Point)
업로드하신 `Recommended library for project progress.md`에서도 언급된 **Pivot Point Setup**이 바로 이 내용입니다.
- **원리:** 냉장고 문(Door)의 경우, 문의 중심이 아닌 '경첩' 위치에 더미 노드를 만들고 문 메쉬를 그 자식으로 넣습니다.
- **효과:** 더미 노드를 회전시키면 문이 경첩을 중심으로 자연스럽게 열립니다.
#### ③ 논리적 그룹화 (Container)
여러 개의 나사(Screw)를 한꺼번에 움직여야 할 때, 나사들을 하나의 더미 노드 아래에 자식으로 둡니다.
- **효과:** 더미 노드 하나만 이동시키면 모든 나사가 일정한 간격을 유지하며 함께 움직입니다.
### 4-4. GLB 내 더미 노드 존재 여부 파악 방법
- 아래 코드를 실행하여 `socket`, `plug`, `hole`, `pin` 등의 이름을 가진 더미 노드가 있는지 확인한다.
```tsx
private printNodeNames(node: THREE.Object3D | null | undefined, prefix: string = ''): void {
	if (!node) return;
	console.log('prefix>> ' + prefix + node.name);
	node.children.forEach(child => this.printNodeNames(child, prefix + '  '));
}

public debugPrintDamperStructure(): void {
	if (!this.sceneRoot) {
		console.warn('[DamperAssemblyService] sceneRoot가 초기화되지 않았습니다.');
		return;
	}

	const damperAssembly = this.sceneRoot.getObjectByName('ACV74674704_Damper_Assembly_13473');
	const damperCover = this.sceneRoot.getObjectByName('MCK71751101_Cover,Body_3117001');

	console.log('=== Damper Assembly 노드 구조 ===');
	this.printNodeNames(damperAssembly);

	console.log('=== Damper Cover 노드 구조 ===');
	this.printNodeNames(damperCover);
}


=== 호출 방법  =======================================
getDamperAssemblyService().debugPrintDamperStructure();
```
### 4-5. 만약, 더미노드가 없다면 `Bounding Box & Offset 기반 방식` 방식과 `Metadata Mapping(메타데이터 매핑)` 을 결합하는 사용해야 한다.
### 4-5-1. 단순 Bounding Box 방식의 한계
업로드하신 `(공통) 3D 모델의 좌표 추출시 고려사항.md`의 `getPreciseBoundingBox` 로직은 매우 훌륭하지만, 다음 상황에서 한계가 있습니다.
- **비대칭 모델:** 홈(Hole)이 한쪽으로 치우쳐진 부품의 경우, Bounding Box의 중심($Center$)이 실제 구멍의 위치가 아닐 수 있습니다.
- **삽입 깊이:** Bounding Box는 부품의 전체 부피를 잡으므로, "얼마나 깊이 밀어 넣어야 하는가"에 대한 정보가 없습니다.
### 2. 추천 방식: "Metadata + Virtual Pivot"
모델링 파일을 수정할 수 없는 상황에서 가장 엔터프라이즈다운 해결책은 **외부 설정 파일(JSON 등)에 각 부품별 오정렬(Offset) 값을 관리**하는 것입니다.
#### 구현 전략:
1. **기준점 추출:** 기존의 `getPreciseBoundingBox`를 사용하여 기본 좌표를 잡습니다.
2. **오프셋 적용:** 해당 부품의 ID(이름)를 키(Key)로 하는 설정 파일에서 미세 조정값($\vec{\delta}$)을 가져와 더합니다.


