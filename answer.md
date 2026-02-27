# PanelDrawerServiceOrchestrator - initializeMetadata 적용 결과

## 개요
`PanelDrawerServiceOrchestrator.ts` 내의 모든 함수에서 `initializeMetadata`를 호출하도록 수정했습니다.

## 수정된 파일

### 1. PanelDrawerServiceOrchestrator.ts

**변경 전:**
```typescript
public handleDrawerClick(clickedObject: THREE.Object3D): boolean {
    // 세제함 노드 이름 추출
    const { assembly: drawerAssemblyName, drawer: drawerName } = this.panelDrawerAnimationService.getDrawerNodeNames();
    // ...
}
```

**변경 후:**
```typescript
public handleDrawerClick(clickedObject: THREE.Object3D): boolean {
    // 메타데이터 초기화 상태 확인 및 필요시 초기화
    this.initializeMetadata();

    // 세제함 노드 이름 추출
    const { assembly: drawerAssemblyName, drawer: drawerName } = this.panelDrawerAnimationService.getDrawerNodeNames();
    // ...
}
```

### 2. PanelDrawerAnimationService.ts

**변경 전:**
```typescript
public getDrawerNodeNames(): { assembly: string | null; drawer: string | null } {
    if (!this.drawerNodeNames) {
        this.drawerNodeNames = {
            assembly: this.loader.getNodeName('drumWashing.detergentStorageParts.drawerAssembly'),
            drawer: this.loader.getNodeName('drumWashing.detergentStorageParts.drawer')
        };
    }
    return this.drawerNodeNames;
}
```

**변경 후:**
```typescript
public getDrawerNodeNames(): { assembly: string | null; drawer: string | null } {
    // 메타데이터 초기화 상태 확인 및 필요시 초기화
    if (!this.isMetadataInitialized) {
        this.initializeMetadata();
    }

    if (!this.drawerNodeNames) {
        this.drawerNodeNames = {
            assembly: this.loader.getNodeName('drumWashing.detergentStorageParts.drawerAssembly'),
            drawer: this.loader.getNodeName('drumWashing.detergentStorageParts.drawer')
        };
    }
    return this.drawerNodeNames;
}
```

## 동작 방식

1. **Singleton 패턴 적용**: `initializeMetadata()`는 `isMetadataInitialized` 플래그를 통해 최초 1회만 초기화됩니다.
2. **이중 확인**: `handleDrawerClick`과 `getDrawerNodeNames` 모두에서 초기화 상태를 확인하여 안전한 메타데이터 로드를 보장합니다.
3. **자동 초기화**: `PanelDrawerAnimationService.getAnimationConfig()` 메서드에서도 이미 초기화 확인이 구현되어 있었습니다.

## 결론
모든 함수에서 명시적으로 `initializeMetadata`를 호출하도록 변경되었으며, 중복 초기화는 `isMetadataInitialized` 플래그로 방지됩니다.
