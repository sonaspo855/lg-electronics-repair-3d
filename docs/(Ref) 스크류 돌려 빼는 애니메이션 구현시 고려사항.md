---
tags:
상태:
중요:
생성일: 26-02-03T16:34:09
수정일: 26-02-03T17:35:40
종료일:
라벨:
summary:
---
## 0. 참고 레퍼런스
- 
##  ■■ Description ■■
- 
## 1. 애니메이션 구현 방식: **복합 트랜스포메이션 (Combined Transformation)**
- 나사를 푸는 동작은 단순히 위치를 옮기는 것이 아니라, **회전(Rotation)** 과 **이동(Translation)** 이 동시에 정비례하게 일어나도록 구현해야 한다.
- **사용 라이브러리 추천:** 
    - `GSAP` (GreenSock Animation Platform) 또는 React Three Fiber의 `useFrame`.
    - **GSAP 추천 이유:** 
        - "나사를 3바퀴 돌리면서 2cm 뒤로 뺀다"와 같은 타임라인 기반의 정밀한 제어가 쉽습니다.
- **핵심 원리:** 나사의 나사산(Pitch)에 맞춰 회전량에 따른 이동 거리를 계산 한다.
    $$이동 거리 = \frac{회전 각도}{360^\circ} \times 나사산 간격(Pitch)$$
## 2. 기능 구현 순서
- 
### 2-1. 제안 방식
1. **회전 애니메이션**: 나사를 회전축(일반적으로 Z축)을 기준으로 회전
2. **이동 애니메이션**: 회전하면서 Z축 방향으로 빼냄
3. **동시 실행**: 회전과 이동을 동시에 수행하여 자연스러운 "돌려서 빼는" 효과
### 2-2. 기술적 구현
- Three.js의 `rotation.z`, `position.z`를 동시에 업데이트
- `requestAnimationFrame`을 사용하여 부드러운 애니메이션
- Easing 함수 적용 (현재 `1 - Math.pow(1 - t, 3)` 사용)
## 3. 구현 순서
### 1단계: 회전 애니메이션 함수 추가
- `animateRotation()` 함수 구현
- 회전 시작각도, 종료각도, 지속시간 파라미터
- 기존 `animateLocalPosition()`과 유사한 구조
### 2단계: 회전+이동 동시 애니메이션 함수 추가
- `animateRotationAndTranslation()` 함수 구현
- 회전과 이동을 동시에 수행
- easing 함수 적용
### 3단계: Screw 노드 감지 로직 추가
- `isFastener()` 함수가 이미 존재 (`/screw|bolt/i.test()`)
- Screw 노드에 대해 회전 애니메이션 적용 조건 추가
### 4단계: handleLoosen 함수 수정
- Screw 노드인지 확인
- Screw일 경우: 회전+이동 애니메이션 사용
- 일반 노드일 경우: 기존 이동 애니메이션 사용
### 5단계: 테스트 및 검증
- Screw 노드 선택 후 "Pull Out" 버튼 클릭
- 회전하면서 빠지는지 확인
- 일반 노드는 기존대로 동작하는지 확인
## 4. 활용 가능한 기존 요소
- **PartAssemblyService.ts**: 
	- GSAP Timeline 사용, 선형 이동 애니메이션 구현 패턴
- **DamperCoverAssemblyService.ts**: 
	- 싱글톤 패턴, 메타데이터 기반 구조
- **NodeHierarchy.tsx**: 
	- `isFastener()` 함수 (`/screw|bolt/i.test()`) 이미 구현됨
- **fridgeConstants.ts**: 
	- Screw 노드 이름 상수 정의됨
### 4-1. 구현 패턴
- 싱글톤 패턴 사용 (DamperAssemblyService.ts 참고)
- GSAP를 활용한 애니메이션 (PartAssemblyService.ts 참고)
- 초기화/정리 메서드 구조
## 4. 새로운 서비스 파일 생성
### 파일: `src/services/fridge/ScrewAnimationService.ts`
**주요 기능:**
1. `initialize(sceneRoot)`: 씬 루트 초기화
2. `animateScrewRotation(nodeName, options)`: Screw 회전+이동 애니메이션
3. `isScrewNode(nodeName)`: Screw 노드 식별
4. `dispose()`: 리소스 정리
**애니메이션 구현:**
- 회전 애니메이션: Z축 기준 회전 (720도 = 2바퀴)
- 이동 애니메이션: 회전과 동시에 Z축 방향으로 빼냄
- 나사산 간격(Pitch) 계산: `이동 거리 = (회전 각도 / 360°) × 나사산 간격`
- GSAP Timeline 사용하여 회전과 이동 동시 실행
**옵션 파라미터:**
- `duration`: 애니메이션 시간 (ms)
- `rotationAngle`: 회전 각도 (기본값: 720도)
- `pullDistance`: 빼내는 거리 (기본값: 2cm)
- `screwPitch`: 나사산 간격 (기본값: 0.5cm)
- `onComplete`: 완료 콜백

## 5. 구현 순서
1. **ScrewAnimationService.ts 생성**
    - 클래스 구조 정의
    - 싱글톤 패턴 구현
    - 초기화 메서드 구현
2. **회전 애니메이션 함수 구현**
    - `animateRotation()` 메서드
    - GSAP를 사용한 회전 애니메이션
3. **회전+이동 동시 애니메이션 구현**
    - `animateScrewRotation()` 메서드
    - 나사산 간격 계산 로직
    - GSAP Timeline 사용
4. **Screw 노드 감지 로직 구현**
    - `isScrewNode()` 메서드
    - NodeHierarchy.tsx의 isFastener() 패턴 활용
5. **ManualAssemblyManager 연동**
    - `loosenScrew()` 메서드 추가
    - ScrewAnimationService 인스턴스 관리
6. **테스트**
    - Screw 노드 선택 후 "Pull Out" 동작 확인
    - 회전하면서 빠지는지 확인
    - 일반 노드는 기존대로 동작하는지 확인
## 6. 기술적 고려사항
### 회전 방향
- 시계 방향 (오른나사 기준)
- 음수 각도로 표현
### 나사산 간격 (Pitch)
- 기본값: 0.5cm (일반적인 나사)
- 옵션으로 조절 가능
### 복수 Screw 처리
- 순차적 처리 필요 시 별도 메서드 추가
- 현재는 단일 Screw 처리에 초점
### 좌표계
- 로컬 좌표계 사용 (PartAssemblyService 패턴)
- 부모 노드의 좌표계 기준

