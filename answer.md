# 스크류2 조립 위치 수정

## 문제
AnimatorAgent.ts:1170-1176 부분에서 `왼쪽 스크류 2 조립` 진행시, AnimatorAgent.ts:1111-1145 라인의 `분리된 왼쪽 스크류2 노드의 위치에서 damperCaseBody 방향으로 선형이동` 한 위치에서 조립이 되어야 합니다. 하지만 현재 방식은 스크류2 노드가 선형이동하기 전 위치로 다시 이동하여 노드가 조립되고 있었습니다.

## 원인
스크류 조립 애니메이션 코드(1147-1181 라인)에서 `moveScrewLinearReverse`를 호출하여 스크류2를 원래 위치로 되돌리고 있었습니다.

## 해결 방법
`moveScrewLinearReverse` 호출을 제거하여 스크류2가 선형 이동한 위치에서 바로 조립되도록 수정했습니다.

## 수정된 코드 (AnimatorAgent.ts:1147-1181)

```typescript
// 스크류 노드를 다시 조이는 코드
try {
  console.log('스크류 조립 애니메이션 시작!!!');

  // 왼쪽 스크류 1 조립 (회전+이동 역방향)
  if (screw1NodeName) {
    const metadataKey1 = extractMetadataKey(screw1NodePath);
    const config1 = getMetadataLoader().getScrewAnimationConfig(metadataKey1);
    await this.manualAssemblyManager.tightenScrew(screw1NodePath, config1 || {});
    console.log('Left screw 1 tightened');
  }

  // 왼쪽 스크류 2 조립 (회전+이동 역방향) - 선형 이동한 위치에서 조립
  if (screw2NodeName) {
    const metadataKey2 = extractMetadataKey(screw2NodePath);
    const config2 = getMetadataLoader().getScrewAnimationConfig(metadataKey2);
    await this.manualAssemblyManager.tightenScrew(screw2NodePath, config2 || {});
    console.log('Left screw 2 tightened');
  }

  console.log('스크류 조립 애니메이션 완료!!!');
} catch (error) {
  console.error('Error during screw tightening:', error);
}
```

## 변경 사항
- **제거된 코드**: `moveScrewLinearReverse` 호출 (1152-1160 라인)
- **수정된 주석**: 스크류2 조립 주석에 "선형 이동한 위치에서 조립" 추가

이제 스크류2는 damperCaseBody 방향으로 선형 이동한 위치에서 바로 조립됩니다.
