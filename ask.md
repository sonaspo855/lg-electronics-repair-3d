{
  "checked": true,
  "command": {
    "action": "damper_cover_body",
    "degrees": 0,
    "door": "top_left",
    "duration": 1500,
    "easing": "power2.inOut",
    "speed": 1,
    "extractDirection": [0.7070744724380162, 0.006205366667985195, 0.7071118609180704],
    "originalPosition": {
      "x": 0,
      "y": 0.0000038783796298957895,
      "z": 0.00005715679071727209
    },
    "targetPosition": {
      "x": 0.0003107425250163942,
      "y": 11.831488984789502,
      "z": 0.073474733540138
    },
    "translationDistance": 0.011831713539553358,
    "position": undefined,
    "rotationAngle": undefined,
    "rotationAxis": undefined
  }
}


- AnimatorAgent.ts assembleDamperCover 함수는 `댐퍼 돌출부/홈 결합 애니메이션 실행`하는 코드이다. console.log('222_Animation history after damper cover assembly:', this.animationHistoryService.getAllHistory()); 출력결과 위와 같다. 
- 위 속성중 originalPosition 는 coverNode 노드의 본래 위치 좌표이고, targetPosition 속성은 coverNode 노드의 이동된 위치의 좌표이다.
- AnimatorAgent.ts:1222-1250 부분 아래 `coverNode 노드의 본래 위치로 복구하는 애니메이션` 코드를 작성하였다.
- 나의 프로젝트에서 재사용 가능한 함수나 속성 코드를 활용하여 올바르게 기능이 구현 되었는지 확인해줘.
