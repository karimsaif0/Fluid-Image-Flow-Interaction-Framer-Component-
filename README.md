# Fluid Image Flow — Framer Component

A GPU-powered fluid image interaction for Framer. Move your pointer across the canvas to push the image through a real-time WebGL fluid simulation, or let Auto Flow create continuous motion when the interaction is idle.

## ✨ Preview

**Live demo:** https://fluidimageflow.framer.website/

**Framer Community:** https://www.framer.com/community/posts/JU7PVFCXKdfkWNAkFTuSgg/

## What it does

Fluid Image Flow turns static imagery into a responsive, tactile visual surface. Two images are passed through the same fluid field, allowing movement to create organic distortion and a dynamic transition between them.

The component is built for Framer with Three.js and includes a static-renderer fallback, reduced-motion support, responsive resizing, visibility-aware rendering, capped device-pixel-ratio, and WebGL resource cleanup.

## Features

- Real-time WebGL fluid simulation
- Pointer and touch interaction
- Automatic idle flow
- Two-image fluid transition
- Four ready-made visual presets
- Custom simulation controls
- Low / Medium / High quality modes
- Responsive simulation resolution
- Image cover handling inside the shader
- Reduced-motion fallback
- Framer static-renderer fallback
- IntersectionObserver rendering pause when off-screen
- ResizeObserver support
- WebGL context-loss handling
- GPU resource disposal on unmount
- Device-pixel-ratio cap for better performance

## Presets

| Preset | Character |
| --- | --- |
| Soft | Gentle movement with longer, calmer trails |
| Fluid | Balanced everyday fluid interaction |
| Energetic | Stronger curl, force, and displacement |
| Liquid | Smooth, expressive liquid motion |
| Custom | Full control over simulation parameters |

## Controls

### Images

**Image A** — The starting image.

**Image B** — The secondary image revealed through the fluid transition.

### Preset

Select Soft, Fluid, Energetic, Liquid, or Custom.

### Quality

Controls simulation resolution and GPU workload.

- Low — lighter rendering cost
- Medium — balanced quality and performance
- High — finer simulation detail

### Image Mix

Sets the base blend between Image A and Image B before the fluid mask contributes additional transition.

### Custom simulation controls

Available when Preset is set to Custom:

- **Displacement** — image distortion strength
- **Curl** — rotational fluid force
- **Force** — pointer velocity injection strength
- **Radius** — size of each fluid injection
- **Dye Dissipation** — how long visible trails remain
- **Velocity Dissipation** — how long movement retains energy
- **Pressure Dissipation** — pressure decay during the solver
- **Pointer Strength** — cursor/touch influence multiplier
- **Auto Flow** — enables idle-generated motion
- **Auto Speed** — controls automatic motion speed

## Installation

1. Open your Framer project.
2. Add a Code Component.
3. Copy `FluidImageFlow.tsx` into the component.
4. Make sure the project has access to `three`.
5. Place the component on the canvas and size it as needed.
6. Add Image A and Image B from the property controls.
7. Choose a preset or switch to Custom.

## Usage

The component is designed to fill its Framer frame. For the best result, give it a meaningful width and height and use high-quality source images with compatible CORS access.

Pointer movement directly influences the fluid field. On touch devices, dragging across the component creates the same interaction.

If Auto Flow is enabled, the simulation generates movement after the pointer has been inactive for a short period.

## Performance

Fluid Image Flow uses multiple render targets and shader passes for velocity, dye, curl, divergence, pressure, and gradient calculations. Because this is a GPU simulation, performance depends on the device and frame size.

For production pages:

- Use **Low** or **Medium** on content-heavy pages.
- Use **High** when the component is a primary visual.
- Avoid unnecessarily huge component dimensions.
- Prefer appropriately sized source images.
- Respect reduced-motion preferences for accessibility.

The component also stops its animation loop while outside the viewport and cleans up WebGL resources when removed.

## Framer compatibility

The component includes:

- `@framerSupportedLayoutWidth any`
- `@framerSupportedLayoutHeight any`
- `addPropertyControls`
- Responsive Image controls
- `useIsStaticRenderer`
- `useReducedMotion`
- Static/export fallback
- Responsive resize handling
- Visibility-aware rendering
- WebGL cleanup

## Project structure

```text
.
├── FluidImageFlow.tsx
└── README.md
```

## Links

- **Live Demo:** https://fluidimageflow.framer.website/
- **Framer Community:** https://www.framer.com/community/posts/JU7PVFCXKdfkWNAkFTuSgg/
- **GitHub:** https://github.com/karimsaif0/Fluid-Image-Flow-Interaction-Framer-Component-
- **X:** https://x.com/karimsaif0

## Credits

Made with 💛 by Karim Saif

Created and customized for Framer by Karim Saif
