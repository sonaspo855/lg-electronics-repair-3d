- screw1NodeName, screw2NodeName, screw1NodePath, screw2NodePath 를 사용하여 AnimatorAgent.ts:1147-1181 부분의 `스크류 노드를 다시 조이는 애니메이션` 코드를 구현 하였다.
- AnimatorAgent.ts:1170-1176 부분에서 `왼쪽 스크류 2 조립` 진행시, AnimatorAgent.ts:1111-1145 라인의 `분리된 왼쪽 스크류2 노드의 위치에서 damperCaseBody 방향으로 선형이동` 한 위치에서 조립이 되어야 한다. 현재 방식은 스크류2 노드가 선형이동하기 전 위치로 다시 이동하여 노드가 조립되고 있다.


