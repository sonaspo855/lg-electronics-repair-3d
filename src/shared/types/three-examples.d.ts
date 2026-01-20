/// <reference types="three" />

// Three.js examples 커스텀 타입 선언
declare module 'three/examples/jsm/controls/OrbitControls' {
    import { OrbitControls as ThreeOrbitControls } from 'three/examples/jsm/controls/OrbitControls'
    export { ThreeOrbitControls as OrbitControls }
}

declare module 'three/examples/jsm/loaders/GLTFLoader' {
    import { GLTFLoader as ThreeGLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
    export { ThreeGLTFLoader as GLTFLoader }
}

declare module 'three/examples/jsm/loaders/DRACOLoader' {
    import { DRACOLoader as ThreeDRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader'
    export { ThreeDRACOLoader as DRACOLoader }
}

declare module 'three/examples/jsm/loaders/OBJLoader' {
    import { OBJLoader as ThreeOBJLoader } from 'three/examples/jsm/loaders/OBJLoader'
    export { ThreeOBJLoader as OBJLoader }
}

declare module 'three/examples/jsm/loaders/MTLLoader' {
    import { MTLLoader as ThreeMTLLoader } from 'three/examples/jsm/loaders/MTLLoader'
    export { ThreeMTLLoader as MTLLoader }
}

declare module 'three/examples/jsm/geometries/ConvexGeometry' {
    import { ConvexGeometry as ThreeConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry'
    export { ThreeConvexGeometry as ConvexGeometry }
}

declare module 'three/examples/jsm/geometries/ParametricGeometry' {
    import { ParametricGeometry as ThreeParametricGeometry } from 'three/examples/jsm/geometries/ParametricGeometry'
    export { ThreeParametricGeometry as ParametricGeometry }
}

declare module 'three/examples/jsm/geometries/TeapotGeometry' {
    import { TeapotGeometry as ThreeTeapotGeometry } from 'three/examples/jsm/geometries/TeapotGeometry'
    export { ThreeTeapotGeometry as TeapotGeometry }
}

declare module 'three/examples/jsm/shaders/CopyShader' {
    import { CopyShader as ThreeCopyShader } from 'three/examples/jsm/shaders/CopyShader'
    export { ThreeCopyShader as CopyShader }
}

declare module 'three/examples/jsm/shaders/LuminosityHighPassShader' {
    import { LuminosityHighPassShader as ThreeLuminosityHighPassShader } from 'three/examples/jsm/shaders/LuminosityHighPassShader'
    export { ThreeLuminosityHighPassShader as LuminosityHighPassShader }
}

declare module 'three/examples/jsm/postprocessing/EffectComposer' {
    import { EffectComposer as ThreeEffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer'
    export { ThreeEffectComposer as EffectComposer }
}

declare module 'three/examples/jsm/postprocessing/RenderPass' {
    import { RenderPass as ThreeRenderPass } from 'three/examples/jsm/postprocessing/RenderPass'
    export { ThreeRenderPass as RenderPass }
}

declare module 'three/examples/jsm/postprocessing/ShaderPass' {
    import { ShaderPass as ThreeShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass'
    export { ThreeShaderPass as ShaderPass }
}

declare module 'three/examples/jsm/postprocessing/UnrealBloomPass' {
    import { UnrealBloomPass as ThreeUnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass'
    export { ThreeUnrealBloomPass as UnrealBloomPass }
}

declare module 'three/examples/jsm/utils/SkeletonUtils' {
    import { Object3D } from 'three'
    export function clone(object: Object3D): Object3D
    export function retarget(target: Object3D, source: Object3D, options: object): void
}