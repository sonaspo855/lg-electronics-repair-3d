




/**
 * 스크류 이동 거리를 계산합니다.
 * @param options 애니메이션 옵션 (extractDistance는 cm 단위)
 * @param metadata 스크류 애니메이션 메타데이터 (extractDistance는 cm 단위)
 * @param screwPitch 나사산 간격 (m)
 * @param rotationAngle 회전 각도 (도)
 * @returns 이동 거리 (cm)
 */
export function calculateTranslationDistance(
    options: { extractDistance?: number },
    metadata: { extractDistance?: number } | null,
    screwPitch: number,
    rotationAngle: number
): number {
    if (options.extractDistance !== undefined) {
        // 입력받은 cm 단위를 그대로 반환
        return options.extractDistance;
    } else if (metadata?.extractDistance !== undefined) {
        // 메타데이터의 cm 단위를 그대로 반환
        return metadata.extractDistance;
    } else {
        // (회전수 * 나사산간격)은 m 단위이므로 100을 곱해 cm로 변환하여 반환
        return (rotationAngle / 360) * screwPitch * 100;
    }
}
