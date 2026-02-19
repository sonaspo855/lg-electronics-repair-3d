




/**
 * 스크류 이동 거리를 계산합니다.
 * @param options 애니메이션 옵션 (pullDistance는 m 단위로 변환된 값이어야 함)
 * @param metadata 스크류 애니메이션 메타데이터
 * @param screwPitch 나사산 간격 (m)
 * @param rotationAngle 회전 각도 (도)
 * @returns 이동 거리 (m)
 */
export function calculateTranslationDistance(
    options: { pullDistance?: number },
    metadata: { extractDistance?: number } | null,
    screwPitch: number,
    rotationAngle: number
): number {
    if (options.pullDistance !== undefined) {
        return options.pullDistance;
    } else if (metadata?.extractDistance !== undefined) {
        return metadata.extractDistance;
    } else {
        return (rotationAngle / 360) * screwPitch;
    }
}
