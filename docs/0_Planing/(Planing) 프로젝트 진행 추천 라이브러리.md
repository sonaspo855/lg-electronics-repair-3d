---
tags:
상태: Planing
중요:
생성일: 26-01-19T14:28:49
수정일: 26-01-20T09:12:08
종료일:
라벨:
  - Planing
작업순서: .nan
---
## 0. 참고 레퍼런스
- **회의록:**
	- 
- **리소스:**
	- 
- **참고자료:**
	- 
## 1. 추천 기술 스택 및 라이브러리
복잡한 부품 분해 시나리오를 부드럽고 확장성 있게 관리하기 위해 아래 라이브러리 조합을 제안한다.
- **React Three Fiber (R3F) & @react-three/drei:** 
	- Three.js를 React 방식으로 선언적으로 작성할 수 있게 해주어, 부품 단위의 컴포넌트화와 상태 관리가 용이하다.
	- **컴포넌트화**: 
		- 캐비넷 커버, 도어, 나사 등을 각각 독립적인 React 컴포넌트로 구성하여 관리 효율성을 극대화한다.
	- **LOD (Level of Detail)**: 
		- 대형 부품은 카메라 거리에 따라 렌더링 품질을 조절하여 웹 브라우저에서의 성능 최적화를 꾀할 수 있다.
	- **선언적 컴포넌트 구조:** 
		- PCB, 하네스, 스크류를 각각 독립된 React 컴포넌트로 관리하여 가독성과 유지보수성을 높인다.
	- **useGLTF:** 
		- 고해상도 PCB 모델을 효율적으로 로딩하고 캐싱한다.
		- 특히 `useGLTF`를 통한 모델 로딩과 `PresentationControls`, `Environment` 등을 통해 조명 및 환경 구축 시간을 획기적으로 단축한다.
	- **ContactShadows**: 
		- 배수통이 본체에서 빠져나올 때 바닥이나 본체 프레임에 생기는 그림자를 실시간으로 처리하여 입체감을 높입니다.
- **Framer Motion 3D:** 
	- 일반적인 애니메이션보다 복잡한 '시퀀스(Sequence)' 기반 애니메이션에 강력하다. 
	- R3F와 완벽하게 통합되어 선언적으로 이동 및 회전 값을 제어할 수 있다.
- **GSAP (GreenSock Animation Platform):** 
	- **타임라인 제어:** 
		- 여러 개의 스크류가 순차적으로 풀리고, 이후 PCB가 들리는 복잡한 시퀀스를 초 단위로 정교하게 설계할 수 있다.
	- **직선 이동 최적화**: 
		- `animateLinearMove`와 같은 로직을 구현할 때, "처음엔 빠르게, 끝엔 부드럽게" 멈추는 수학적 Easing 공식을 가장 정교하게 적용할 수 있다.
- **Skinned Mesh & Bones (케이블 표현):**
	- 하네스(케이블) 분리 시 단순 직선 이동이 아닌, 실제 전선처럼 부드럽게 휘어지며 빠지는 연출을 위해 **Skinned Mesh** 방식을 강력히 추천한다.
- **Physics-based Animation (CANNON.js 등)**:
	- 캐비넷 커버가 분리될 때 중력이나 충돌을 미세하게 적용하여 실제 현장감 있는 분해 경험을 제공할 수 있다.
- **Zustand (상태 관리)**:
	- 사용자의 클릭 이벤트를 감지하여 애니메이션의 시작과 종료 상태를 관리하기에 적합하다.
- **Pivot 포인트 설정:** 
	- 부품이 제자리에서 도는 것이 아니라 경첩이나 특정 축을 중심으로 움직여야 하므로, 3D 모델링 단계 혹은 코드 상에서 가상의 **Pivot(Group)** 을 생성하여 계층 구조를 재설정하는 작업이 선행되어야 한다.
- **이징(Easing) 함수 활용:** 
	- `power2.out`과 같은 수학적 감속 공식을 적용하여, 부품이 멈출 때 실제 물리 법칙처럼 부드럽게 멈추도록 구현

## 2. 영어 변환
- [[Recommended library for project progress]]
```txt
## 0. Reference

- ## **Meeting Minutes:**
    
- ## **Resources:**
    
- ## **Reference Materials:**
    

## 1. Recommended Tech Stack & Libraries

To manage complex component disassembly scenarios smoothly and with scalability, we propose the following library combinations:

- **React Three Fiber (R3F) & @react-three/drei:** - Enables declarative Three.js development within React, facilitating easy componentization of parts and efficient state management.
    
    - **Componentization**:
        
        - Maximize management efficiency by organizing cabinet covers, doors, and screws into independent React components.
            
    - **LOD (Level of Detail)**:
        
        - Optimize web browser performance by adjusting rendering quality of large components based on camera distance.
            
    - **Declarative Structure**:
        
        - Improve readability and maintainability by managing PCBs, harnesses, and screws as separate React components.
            
    - **useGLTF**:
        
        - Efficiently loads and caches high-resolution PCB models.
            
        - Dramatically reduces development time for lighting and environment setup using `useGLTF`, `PresentationControls`, and `Environment`.
            
    - **ContactShadows**:
        
        - Enhances three-dimensional depth by processing real-time shadows when the drainage tank is removed from the main body.
            
- **Framer Motion 3D:** - Powerful for 'Sequence-based' animations that are more complex than standard animations.
    
    - Integrates seamlessly with R3F to declaratively control movement and rotation values.
        
- GSAP (GreenSock Animation Platform): - Timeline Control:
    
    - Enables precise, second-by-second design of complex sequences, such as multiple screws unscrewing in order followed by the PCB being lifted.
    
    - **Linear Movement Optimization**:
        
        - Best for applying sophisticated mathematical Easing formulas (e.g., "fast start, smooth stop") when implementing logic like `animateLinearMove`.
            
- **Skinned Mesh & Bones (Cable Representation):**
    
    - Strongly recommended for harness (cable) disconnection to achieve realistic effects where wires bend and slide out naturally, rather than moving in simple straight lines.
        
- **Physics-based Animation (CANNON.js, etc.):**
    
    - Can provide a realistic disassembly experience by applying subtle gravity or collision effects when the cabinet cover is detached.
        
- **Zustand (State Management):**
    
    - Ideal for managing the start and end states of animations by detecting user click events.
        
- **Pivot Point Setup:** - Since parts must move around hinges or specific axes rather than rotating in place, a prerequisite is creating virtual **Pivots (Groups)** in the 3D modeling stage or via code to reset the hierarchy.
    
- **Easing Function Utilization:** - Apply mathematical deceleration formulas like `power2.out` to ensure parts stop smoothly, mimicking actual physical laws.
```