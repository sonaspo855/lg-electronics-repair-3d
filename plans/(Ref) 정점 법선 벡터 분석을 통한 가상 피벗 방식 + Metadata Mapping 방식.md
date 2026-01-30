---
tags:
상태: Ref
중요:
생성일: 26-01-28T14:19:36
수정일: 26-01-30T14:41:49
종료일:
라벨:
  - 냉장고
  - Ref
---
## 0. 참고 레퍼런스
- [[(Ref) Bounding Box & Offset 기반 + Metadata Mapping 방식]]
- [[(Learn) 법선 벡터 기반 방식]]
- [[(Learn) Outline Shader, Stencil Buffer 방식]]
##  ■■ Description ■■
- 
## 가상 피벗(Virtual Pivot) 기반 조립 구현 계획서
- 본 문서는 3D 모델 내에 물리적인 **더미 노드(Socket/Pivot)가 없는** 환경에서, 
  **정점 법선 벡터 분석(Vertex Normal Analysis)** 을 통해 가상의 조립 기준점을 추출하고 
  이를 활용해 정밀 조립을 수행하는 방식을 정의한다.
## 1. 개요 (Overview)
*   **목적:** 수동 수치 조정(Ratio 등)을 최소화하고, 기하학적 특징을 기반으로 조립 위치를 자동 계산.
*   **핵심 기술:** 
	* Vertex Normal Filtering, 
	* World-to-Local Coordinate Transformation, 
	* GSAP Animation
*   **대상 부품:** 댐퍼 커버(Moving Part) 및 댐퍼 어셈블리(Target Part).
## 2. 정점 법선 벡터 분석 방식 장단점
**장점:**
- ✅ **자동화**: 모델링 데이터만 있으면 자동으로 돌출부/홈 탐지
- ✅ **유연성**: 새로운 부품 추가 시 코드 수정 불필요
- ✅ **확장성**: 다양한 형상의 부품에 적용 가능
**단점:**
- ❌ **정확성 문제**: 복잡한 형상에서 오탐지 가능성
- ❌ **성능**: 대규모 모델에서 정점 분석에 시간 소요
- ❌ **디버깅 어려움**: 파라미터 튜닝이 복잡함
## 3. 구현 전략
1) 메타데이터 정보 접근
2) 정점 분석 자동 탐지
	   - 자동으로 돌출부/홈 탐지
3) 정점 분석 실패 시 Bounding Box 방식으로 대체
4) 정점 분석이 성공하면 결과를 메타데이터로 저장
