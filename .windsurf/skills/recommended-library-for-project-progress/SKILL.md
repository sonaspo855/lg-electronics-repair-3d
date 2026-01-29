---
name: recommended-library-for-project-progress
description: A brief description, shown to the model to help it understand when to use this skill
---

## 1. Recommended Tech Stack & Libraries

To manage complex component disassembly scenarios smoothly and with scalability, we propose the following library combinations:

- **React Three Fiber (R3F) & @react-three/drei:** - Enables declarative Three.js development within React, facilitating easy componentization of parts and efficient state management.
    
    - **Componentization**:
        
        - Maximize management efficiency by organizing cabinet covers, doors, and screws into independent React components.
            
    - **LOD (Level of Detail)**:
        
        - Optimize web browser performance by adjusting rendering quality of large components based on camera distance.
            
    - **Declarative Structure**:
        
        - Improve readability and maintainability by managing PCBs, harnesses, and screws as separate React components.
            
    - **useGLTF**:
        
        - Efficiently loads and caches high-resolution PCB models.
            
        - Dramatically reduces development time for lighting and environment setup using `useGLTF`, `PresentationControls`, and `Environment`.
            
    - **ContactShadows**:
        
        - Enhances three-dimensional depth by processing real-time shadows when the drainage tank is removed from the main body.
            
- **Framer Motion 3D:** - Powerful for 'Sequence-based' animations that are more complex than standard animations.
    
    - Integrates seamlessly with R3F to declaratively control movement and rotation values.
        
- GSAP (GreenSock Animation Platform): - Timeline Control:
    
    - Enables precise, second-by-second design of complex sequences, such as multiple screws unscrewing in order followed by the PCB being lifted.
    
    - **Linear Movement Optimization**:
        
        - Best for applying sophisticated mathematical Easing formulas (e.g., "fast start, smooth stop") when implementing logic like `animateLinearMove`.
            
- **Skinned Mesh & Bones (Cable Representation):**
    
    - Strongly recommended for harness (cable) disconnection to achieve realistic effects where wires bend and slide out naturally, rather than moving in simple straight lines.
        
- **Physics-based Animation (CANNON.js, etc.):**
    
    - Can provide a realistic disassembly experience by applying subtle gravity or collision effects when the cabinet cover is detached.
        
- **Zustand (State Management):**
    
    - Ideal for managing the start and end states of animations by detecting user click events.
        
- **Pivot Point Setup:** - Since parts must move around hinges or specific axes rather than rotating in place, a prerequisite is creating virtual **Pivots (Groups)** in the 3D modeling stage or via code to reset the hierarchy.
    
- **Easing Function Utilization:** - Apply mathematical deceleration formulas like `power2.out` to ensure parts stop smoothly, mimicking actual physical laws.
