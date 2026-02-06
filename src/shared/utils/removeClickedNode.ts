// import * as THREE from 'three';
import type { ThreeEvent } from '@react-three/fiber';


/**
 * 클릭된 노드를 삭제하는 함수
 * @param event 마우스 이벤트
 */
export const removeClickedNode = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    if (!event.intersections || event.intersections.length === 0) {
        return;
    }

    const clickedObject = event.intersections[0].object;

    if (clickedObject && clickedObject.parent) {
        clickedObject.parent.remove(clickedObject);
        console.log('클릭된 오브젝트를 부모로부터 분리했습니다: ' + clickedObject.name);
    }

};
