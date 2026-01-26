# 댐퍼 조립 애니메이션 구현 가이드

## 📋 개요

이 가이드는 `LEFT_DOOR_DAMPER_COVER_BODY_NODE`를 `LEFT_DOOR_DAMPER_ASSEMBLY_NODE`로 정밀하게 조립하는 애니메이션 시스템의 사용법을 설명합니다.

## 🎯 주요 기능

- ✅ **정밀한 좌표 변환**: 월드-로컬 좌표계 자동 변환
- ✅ **GSAP Timeline 기반**: 3단계 시퀀스 애니메이션 (들어올림 → 이동 → 스냅)
- ✅ **스냅 효과**: 자석처럼 끌어당기는 자연스러운 결합
- ✅ **진행률 모니터링**: 실시간 애니메이션 상태 추적
- ✅ **되돌리기 지원**: 조립/분해 양방향 애니메이션

## 📦 구현된 파일

### 핵심 서비스
- [`src/services/fridge/PartAssemblyService.ts`](../src/services/fridge/PartAssemblyService.ts) - 부품 조립 메인 서비스

### 유틸리티
- [`src/shared/utils/CoordinateTransformUtils.ts`](../src/shared/utils/CoordinateTransformUtils.ts) - 좌표계 변환
- [`src/shared/utils/SnapDetectionUtils.ts`](../src/shared/utils/SnapDetectionUtils.ts) - 스냅 감지 및 적용

### 예시 코드
- [`examples/damper-assembly-example.ts`](../examples/damper-assembly-example.ts) - 다양한 사용 예시

## 🚀 빠른 시작

### 1. 기본 사용법

```typescript
import { PartAssemblyService } from './services/fridge/PartAssemblyService';
import { 
    LEFT_DOOR_DAMPER_COVER_BODY_NODE,
    LEFT_DOOR_DAMPER_ASSEMBLY_NODE 
} from './shared/utils/fridgeConstants';

// 서비스 초기화
const assemblyService = new PartAssemblyService(sceneRoot);

// 조립 실행
await assemblyService.assemblePart(
    LEFT_DOOR_DAMPER_COVER_BODY_NODE,
    LEFT_DOOR_DAMPER_ASSEMBLY_NODE,
    {
        duration: 2500,      // 2.5초
        liftHeight: 2.0,     // 2 유닛 들어올림
        snapThreshold: 0.2,  // 0.2 유닛 이내에서 스냅
        onProgress: (progress) => {
            console.log(`진행률: ${(progress * 100).toFixed(1)}%`);
        },
        onSnap: () => {
            console.log('스냅 존 진입!');
        },
        onComplete: () => {
            console.log('조립 완료!');
        }
    }
);
```

### 2. 분해 (되돌리기)

```typescript
// 조립된 부품을 원래 위치로 되돌림
await assemblyService.disassemblePart(
    LEFT_DOOR_DAMPER_COVER_BODY_NODE,
    {
        duration: 1500,
        liftHeight: 1.5
    }
);
```

## 📖 API 레퍼런스

### PartAssemblyService

#### `assemblePart(sourceNodeName, targetNodeName, options)`

부품을 타겟 위치로 조립합니다.

**Parameters:**
- `sourceNodeName` (string): 이동할 부품 노드 이름
- `targetNodeName` (string): 목적지 노드 이름
- `options` (AssemblyOptions): 애니메이션 옵션

**Options:**
```typescript
interface AssemblyOptions {
    duration?: number;           // 전체 애니메이션 시간 (ms, 기본값: 2000)
    liftHeight?: number;         // 들어올리는 높이 (기본값: 1.5)
    snapThreshold?: number;      // 스냅 감지 임계값 (기본값: 0.15)
    easing?: string;             // GSAP easing (기본값: 'power3.inOut')
    onProgress?: (progress: number) => void;
    onSnap?: () => void;
    onComplete?: () => void;
}
```

**Returns:** `Promise<void>`

#### `disassemblePart(partNodeName, options)`

조립된 부품을 원래 위치로 분해합니다.

**Parameters:**
- `partNodeName` (string): 분해할 부품 노드 이름
- `options` (AssemblyOptions): 애니메이션 옵션

**Returns:** `Promise<void>`

#### `pause()`

현재 애니메이션을 일시정지합니다.

#### `resume()`

일시정지된 애니메이션을 재개합니다.

#### `reverse()`

애니메이션을 역방향으로 재생합니다.

**Returns:** `Promise<void>`

#### `getProgress()`

현재 애니메이션 진행률을 반환합니다.

**Returns:** `number` (0~1)

#### `isPlaying()`

애니메이션이 재생 중인지 확인합니다.

**Returns:** `boolean`

#### `dispose()`

서비스를 정리하고 메모리를 해제합니다.

## 🎨 애니메이션 단계

### 1단계: 들어올리기 (0.5초)
- 부품을 현재 위치에서 `liftHeight`만큼 위로 이동
- Easing: `power2.out`

### 2단계: 타겟으로 이동 (가변)
- 들어올린 위치에서 타겟 위치로 이동
- 스냅 존 감지 시작
- Easing: 사용자 지정 (기본값: `power3.inOut`)

### 3단계: 스냅 효과 (0.3초)
- 타겟 위치에 정확히 결합
- 오버슈트 효과로 자연스러운 착지
- Easing: `back.out(3)`

## 💡 고급 사용 예시

### 커스텀 이징 효과

```typescript
await assemblyService.assemblePart(
    LEFT_DOOR_DAMPER_COVER_BODY_NODE,
    LEFT_DOOR_DAMPER_ASSEMBLY_NODE,
    {
        duration: 3000,
        easing: 'elastic.out(1, 0.5)', // 탄성 효과
        onSnap: () => {
            // 파티클 효과나 사운드 재생
            playSnapSound();
            showParticleEffect();
        }
    }
);
```

### 진행률 UI 업데이트

```typescript
await assemblyService.assemblePart(
    LEFT_DOOR_DAMPER_COVER_BODY_NODE,
    LEFT_DOOR_DAMPER_ASSEMBLY_NODE,
    {
        duration: 2500,
        onProgress: (progress) => {
            // 프로그레스 바 업데이트
            const percentage = Math.round(progress * 100);
            document.getElementById('progress-bar').style.width = `${percentage}%`;
            document.getElementById('progress-text').textContent = `${percentage}%`;
        }
    }
);
```

### 애니메이션 제어

```typescript
// 조립 시작
const assemblyPromise = assemblyService.assemblePart(
    LEFT_DOOR_DAMPER_COVER_BODY_NODE,
    LEFT_DOOR_DAMPER_ASSEMBLY_NODE,
    { duration: 5000 }
);

// 1초 후 일시정지
setTimeout(() => assemblyService.pause(), 1000);

// 3초 후 재개
setTimeout(() => assemblyService.resume(), 3000);

// 완료 대기
await assemblyPromise;
```

## 🔧 좌표계 변환 유틸리티

### CoordinateTransformUtils

```typescript
import { CoordinateTransformUtils } from './shared/utils/CoordinateTransformUtils';

// 월드 좌표를 로컬 좌표로 변환
const worldPos = new THREE.Vector3(10, 5, 3);
const localPos = CoordinateTransformUtils.worldToLocal(worldPos, parentNode);

// 객체의 월드 중심점 가져오기
const center = CoordinateTransformUtils.getWorldCenter(targetNode);

// 두 객체 간 거리 계산
const distance = CoordinateTransformUtils.getWorldDistance(obj1, obj2);
```

## 🎯 스냅 감지 유틸리티

### SnapDetectionUtils

```typescript
import { SnapDetectionUtils } from './shared/utils/SnapDetectionUtils';

// 스냅 존 진입 확인
if (SnapDetectionUtils.isInSnapZone(currentPos, targetPos, 0.2)) {
    console.log('스냅 존 진입!');
}

// 스냅 효과 적용
await SnapDetectionUtils.applySnapEffect(object, targetPos, {
    duration: 0.5,
    easing: 'elastic.out(1, 0.5)'
});

// 스냅 존 시각화 (디버깅용)
const helper = SnapDetectionUtils.visualizeSnapZone(scene, targetPos, 0.15);
// 나중에 제거
SnapDetectionUtils.removeSnapZoneHelper(scene);
```

## 🐛 디버깅

### 콘솔 로그 확인

서비스는 각 단계마다 상세한 로그를 출력합니다:

```
[Assembly] 조립 시작: { source: '...', target: '...', config: {...} }
[Assembly] 타겟 월드 중심점: Vector3(x, y, z)
[Assembly] 타겟 로컬 좌표: Vector3(x, y, z)
[Assembly] 시작 위치: Vector3(x, y, z)
[Assembly] 단계 1: 부품 들어올리기 시작
[Assembly] 단계 1: 부품 들어올리기 완료
[Assembly] 단계 2: 타겟 위치로 이동 시작
[Assembly] 스냅 존 진입! 거리: 0.123
[Assembly] 단계 2: 타겟 위치로 이동 완료
[Assembly] 단계 3: 스냅 효과 시작
[Assembly] 단계 3: 스냅 효과 완료
[Assembly] 최종 거리: 0.0001
[Assembly] 조립 완료: ...
```

### 스냅 존 시각화

```typescript
// 디버깅 모드에서 스냅 존을 시각적으로 표시
const helper = SnapDetectionUtils.visualizeSnapZone(
    scene,
    targetPosition,
    0.15,  // threshold
    0x00ff00  // 녹색
);

// 애니메이션 완료 후 제거
await assemblyService.assemblePart(...);
SnapDetectionUtils.removeSnapZoneHelper(scene);
```

## ⚠️ 주의사항

### 1. 노드 이름 확인
```typescript
// 노드가 존재하는지 먼저 확인
const sourceNode = sceneRoot.getObjectByName(LEFT_DOOR_DAMPER_COVER_BODY_NODE);
if (!sourceNode) {
    console.error('Source node not found!');
    return;
}
```

### 2. 메모리 정리
```typescript
// 컴포넌트 언마운트 시 반드시 정리
useEffect(() => {
    const assemblyService = new PartAssemblyService(sceneRoot);
    
    return () => {
        assemblyService.dispose();
    };
}, []);
```

### 3. 애니메이션 중복 실행 방지
```typescript
if (assemblyService.isPlaying()) {
    console.warn('애니메이션이 이미 실행 중입니다.');
    return;
}

await assemblyService.assemblePart(...);
```

## 📊 성능 최적화

### 1. 바운딩 박스 캐싱
```typescript
// 반복적으로 사용되는 노드의 바운딩 박스는 캐싱됨
// 추가 최적화 불필요
```

### 2. Timeline 재사용
```typescript
// 서비스 내부에서 자동으로 Timeline을 재사용
// 매번 새로 생성하지 않음
```

### 3. 프레임 레이트 관리
```typescript
// GSAP의 ticker 설정 (전역)
gsap.ticker.fps(60);
gsap.ticker.lagSmoothing(500, 33);
```

## 🧪 테스트

### 단위 테스트 예시

```typescript
describe('PartAssemblyService', () => {
    let scene: THREE.Scene;
    let assemblyService: PartAssemblyService;
    
    beforeEach(() => {
        scene = new THREE.Scene();
        // 테스트용 노드 생성
        const coverBody = new THREE.Mesh(
            new THREE.BoxGeometry(1, 1, 1),
            new THREE.MeshBasicMaterial()
        );
        coverBody.name = 'CoverBody';
        scene.add(coverBody);
        
        assemblyService = new PartAssemblyService(scene);
    });
    
    test('부품이 타겟 위치로 정확히 이동', async () => {
        await assemblyService.assemblePart('CoverBody', 'Assembly', {
            duration: 100
        });
        
        const coverBody = scene.getObjectByName('CoverBody');
        const assembly = scene.getObjectByName('Assembly');
        
        expect(coverBody?.position.distanceTo(assembly!.position)).toBeLessThan(0.01);
    });
});
```

## 📚 추가 리소스

- [GSAP 공식 문서](https://greensock.com/docs/)
- [Three.js 좌표계 가이드](https://threejs.org/docs/#manual/en/introduction/Matrix-transformations)
- [설계 문서](../plans/damper-assembly-animation-architecture.md)

## 🤝 기여

버그 리포트나 기능 제안은 이슈로 등록해 주세요.

## 📝 라이선스

이 프로젝트는 MIT 라이선스를 따릅니다.
