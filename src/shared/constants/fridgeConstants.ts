import * as THREE from 'three';

export const LEFT_DOOR_DAMPER_COVER_BODY_NODE = "MCK71751101_Cover,Body_3117001";
export const LEFT_DOOR_DAMPER_ASSEMBLY_NODE = "ACV74674704_Damper_Assembly_13473";
export const LEFT_DOOR_SCREW1_CUSTOMIZED_NODE = "4J01424B_Screw,Customized_4168029";
export const LEFT_DOOR_SCREW2_CUSTOMIZED_NODE = "4J01424B_Screw,Customized_4168028";

export const LEFT_DOOR_NODES = [
    LEFT_DOOR_DAMPER_COVER_BODY_NODE,
    LEFT_DOOR_DAMPER_ASSEMBLY_NODE,
    LEFT_DOOR_SCREW1_CUSTOMIZED_NODE,
    LEFT_DOOR_SCREW2_CUSTOMIZED_NODE
];

/**
 * 슬롯 삽입 관련 상수
 * 댐퍼 커버를 댐퍼 어셈블리의 홈에 삽입하기 위한 오프셋 설정
 */
export const DAMPER_COVER_SLOT_OFFSET = new THREE.Vector3(0, 0, 0); // 오프셋 없이 정확한 홈 위치로 이동
export const SLOT_INSERTION_DIRECTION = 'X_AXIS'; // 삽입 방향: X_AXIS 또는 Y_AXIS
