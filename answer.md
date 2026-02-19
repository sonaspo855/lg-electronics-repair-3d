### calculateTranslationDistance 함수 이동 및 공통 함수화 내역

#### 1. 대상 파일 및 위치
- **이동 전:** `src/shared/utils/screwAnimationUtils.ts`
- **이동 후:** `src/services/assembly/PartAssemblyService.ts`
- **선정 이유:** `PartAssemblyService.ts`는 모든 부품의 조립/분해 로직을 담당하는 핵심 서비스로, 스크류뿐만 아니라 다른 부품들의 이동 거리 계산 로직을 통합 관리하기에 가장 적합한 위치입니다.

#### 2. 주요 변경 사항
- `calculateTranslationDistance` 함수를 `PartAssemblyService.ts` 파일 하단으로 이동하여 공통 함수로 내보냈습니다.
- 스크류에 국한되지 않도록 주석의 `screwPitch`를 `pitch`로 범용화하였습니다.
- `ScrewAnimationService.ts`에서 해당 함수의 임포트 경로를 새로운 위치로 업데이트하였습니다.

```typescript
// src/services/assembly/PartAssemblyService.ts 내 공통 함수
/**
 * 부품 조립/분해 시 이동 거리를 계산하는 공통 함수
 * @param options 애니메이션 옵션 (extractDistance는 cm 단위)
 * @param metadata 메타데이터 (extractDistance는 cm 단위)
 * @param pitch 나사산/기본 간격 (m)
 * @param rotationAngle 회전 각도 (도)
 * @returns 이동 거리 (cm)
 */
export function calculateTranslationDistance(
    options: { extractDistance?: number },
    metadata: { extractDistance?: number } | null,
    pitch: number,
    rotationAngle: number
): number {
    if (options.extractDistance !== undefined) {
        return options.extractDistance;
    } else if (metadata?.extractDistance !== undefined) {
        return metadata.extractDistance;
    } else {
        // (회전수 * 간격)은 m 단위이므로 100을 곱해 cm로 변환하여 반환
        return (rotationAngle / 360) * pitch * 100;
    }
}
```

#### 3. 파일 정리
- 기존에 함수가 정의되어 있던 `src/shared/utils/screwAnimationUtils.ts` 파일의 내용은 삭제되었습니다.
