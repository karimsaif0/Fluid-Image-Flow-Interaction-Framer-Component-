/**
 * Made with 💛 by Karim Saif
 * Created and customized for Framer by Karim Saif
 *
 * @framerIntrinsicWidth 1200
 * @framerIntrinsicHeight 800
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight any
 */

import * as React from "react"
import {
    addPropertyControls,
    ControlType,
    useIsStaticRenderer,
    useReducedMotion,
} from "framer"
import * as THREE from "three"
import { useEffect, useRef } from "react"

type ResponsiveImageValue =
    | {
          src?: string
          srcSet?: string
          alt?: string
      }
    | string
    | undefined

type FluidConfig = {
    densityDissipation: number
    velocityDissipation: number
    pressureDissipation: number
    curl: number
    radius: number
    displacement: number
    splatForce: number
    autoFlow: boolean
    autoFlowSpeed: number
    pointerStrength: number
}

type PresetName = "Soft" | "Fluid" | "Energetic" | "Liquid" | "Custom"

const PRESETS: Record<PresetName, Partial<FluidConfig>> = {
    Soft: { densityDissipation: 0.965, velocityDissipation: 0.985, pressureDissipation: 0.86, curl: 7, radius: 0.0035, displacement: 0.24, splatForce: 3.5, autoFlow: true, autoFlowSpeed: 0.55, pointerStrength: 0.7 },
    Fluid: { densityDissipation: 0.94, velocityDissipation: 0.98, pressureDissipation: 0.8, curl: 12, radius: 0.002, displacement: 0.4, splatForce: 6, autoFlow: true, autoFlowSpeed: 1, pointerStrength: 1 },
    Energetic: { densityDissipation: 0.925, velocityDissipation: 0.965, pressureDissipation: 0.74, curl: 22, radius: 0.0015, displacement: 0.62, splatForce: 10, autoFlow: true, autoFlowSpeed: 1.35, pointerStrength: 1.25 },
    Liquid: { densityDissipation: 0.955, velocityDissipation: 0.975, pressureDissipation: 0.82, curl: 16, radius: 0.0025, displacement: 0.5, splatForce: 7.5, autoFlow: true, autoFlowSpeed: 0.8, pointerStrength: 1.1 },
    Custom: {},
}

const DEFAULT_CONFIG: FluidConfig = {
    densityDissipation: 0.94,
    velocityDissipation: 0.98,
    pressureDissipation: 0.8,
    curl: 12,
    radius: 0.002,
    displacement: 0.4,
    splatForce: 6,
    autoFlow: true,
    autoFlowSpeed: 1,
    pointerStrength: 1,
}

const SIM_RESOLUTION = 160
const PRESSURE_ITERATIONS = 18

const BASE_VERTEX = `precision highp float;
attribute vec3 position;
attribute vec2 uv;
varying vec2 vUv;
void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}`

const STENCIL_VERTEX = `precision highp float;
attribute vec3 position;
attribute vec2 uv;
uniform vec2 texelSize;
varying vec2 vUv;
varying vec2 vL;
varying vec2 vR;
varying vec2 vT;
varying vec2 vB;
void main(){vUv=uv;vL=uv-vec2(texelSize.x,0.0);vR=uv+vec2(texelSize.x,0.0);vT=uv+vec2(0.0,texelSize.y);vB=uv-vec2(0.0,texelSize.y);gl_Position=vec4(position.xy,0.0,1.0);}`

const SPLAT_FRAG = `precision highp float;
uniform sampler2D uTarget;
uniform float aspectRatio;
uniform vec3 color;
uniform vec2 point;
uniform float radius;
varying vec2 vUv;
void main(){vec2 p=vUv-point;p.x*=aspectRatio;vec3 splat=exp(-dot(p,p)/radius)*color;vec3 base=texture2D(uTarget,vUv).xyz;gl_FragColor=vec4(base+splat,1.0);}`

const ADVECTION_FRAG = `precision highp float;
uniform sampler2D uVelocity;
uniform sampler2D uSource;
uniform vec2 texelSize;
uniform float dt;
uniform float dissipation;
varying vec2 vUv;
void main(){vec2 coord=vUv-dt*texture2D(uVelocity,vUv).xy*texelSize;gl_FragColor=dissipation*texture2D(uSource,coord);}`

const CURL_FRAG = `precision highp float;
uniform sampler2D uVelocity;
varying vec2 vL;varying vec2 vR;varying vec2 vT;varying vec2 vB;
void main(){float L=texture2D(uVelocity,vL).y;float R=texture2D(uVelocity,vR).y;float T=texture2D(uVelocity,vT).x;float B=texture2D(uVelocity,vB).x;float vorticity=R-L-T+B;gl_FragColor=vec4(0.5*vorticity,0.0,0.0,1.0);}`

const VORTICITY_FRAG = `precision highp float;
uniform sampler2D uVelocity;uniform sampler2D uCurl;uniform float curl;uniform float dt;
varying vec2 vUv;varying vec2 vL;varying vec2 vR;varying vec2 vT;varying vec2 vB;
void main(){float L=texture2D(uCurl,vL).x;float R=texture2D(uCurl,vR).x;float T=texture2D(uCurl,vT).x;float B=texture2D(uCurl,vB).x;float C=texture2D(uCurl,vUv).x;vec2 force=0.5*vec2(abs(T)-abs(B),abs(R)-abs(L));force/=length(force)+0.0001;force*=curl*C;force.y*=-1.0;vec2 velocity=texture2D(uVelocity,vUv).xy;velocity+=force*dt;velocity=clamp(velocity,-1000.0,1000.0);gl_FragColor=vec4(velocity,0.0,1.0);}`

const DIVERGENCE_FRAG = `precision highp float;
uniform sampler2D uVelocity;
varying vec2 vUv;varying vec2 vL;varying vec2 vR;varying vec2 vT;varying vec2 vB;
void main(){float L=texture2D(uVelocity,vL).x;float R=texture2D(uVelocity,vR).x;float T=texture2D(uVelocity,vT).y;float B=texture2D(uVelocity,vB).y;vec2 C=texture2D(uVelocity,vUv).xy;if(vL.x<0.0)L=-C.x;if(vR.x>1.0)R=-C.x;if(vT.y>1.0)T=-C.y;if(vB.y<0.0)B=-C.y;float div=0.5*(R-L+T-B);gl_FragColor=vec4(div,0.0,0.0,1.0);}`

const CLEAR_FRAG = `precision highp float;
uniform sampler2D uTexture;uniform float value;varying vec2 vUv;
void main(){gl_FragColor=value*texture2D(uTexture,vUv);}`

const PRESSURE_FRAG = `precision highp float;
uniform sampler2D uPressure;uniform sampler2D uDivergence;
varying vec2 vUv;varying vec2 vL;varying vec2 vR;varying vec2 vT;varying vec2 vB;
void main(){float L=texture2D(uPressure,vL).x;float R=texture2D(uPressure,vR).x;float T=texture2D(uPressure,vT).x;float B=texture2D(uPressure,vB).x;float divergence=texture2D(uDivergence,vUv).x;float pressure=(L+R+B+T-divergence)*0.25;gl_FragColor=vec4(pressure,0.0,0.0,1.0);}`

const GRADIENT_FRAG = `precision highp float;
uniform sampler2D uPressure;uniform sampler2D uVelocity;
varying vec2 vUv;varying vec2 vL;varying vec2 vR;varying vec2 vT;varying vec2 vB;
void main(){float L=texture2D(uPressure,vL).x;float R=texture2D(uPressure,vR).x;float T=texture2D(uPressure,vT).x;float B=texture2D(uPressure,vB).x;vec2 velocity=texture2D(uVelocity,vUv).xy;velocity-=vec2(R-L,T-B);gl_FragColor=vec4(velocity,0.0,1.0);}`

const DISPLAY_FRAG = `precision highp float;
uniform sampler2D uImage;uniform sampler2D uImageB;uniform sampler2D uDye;
uniform vec2 resolution;uniform vec2 uImageResolution;uniform vec2 uImageResolutionB;
uniform float uDisplacement;uniform float uImageMix;
varying vec2 vUv;
vec2 coverUV(vec2 uv,vec2 imageRes){float screenAspect=resolution.x/max(resolution.y,1.0);float imageAspect=imageRes.x/max(imageRes.y,1.0);vec2 scale=vec2(1.0);if(screenAspect>imageAspect){scale.y=imageAspect/screenAspect;}else{scale.x=screenAspect/imageAspect;}return(uv-0.5)*scale+0.5;}
void main(){vec3 dye=texture2D(uDye,vUv).rgb;vec2 distortion=dye.rg*uDisplacement;float mask=clamp(length(dye.rg)*1.5,0.0,1.0);vec3 a=texture2D(uImage,coverUV(vUv+distortion,uImageResolution)).rgb;vec3 b=texture2D(uImageB,coverUV(vUv+distortion*1.6,uImageResolutionB)).rgb;float finalMix=clamp(uImageMix+smoothstep(0.0,0.6,mask),0.0,1.0);vec3 col=mix(a,b,finalMix);col+=abs(vec3(dye.r,dye.g*0.6,-dye.r))*0.18*mask;gl_FragColor=vec4(col,1.0);}`

function getImageURL(image: ResponsiveImageValue): string {
    if (!image) return ""
    if (typeof image === "string") return image
    return image.src || ""
}

function FluidImageCanvas({ image, imageB, preset, densityDissipation, velocityDissipation, pressureDissipation, curl, radius, displacement, splatForce, autoFlow, autoFlowSpeed, pointerStrength, quality, imageMix }: {
    image: ResponsiveImageValue
    imageB: ResponsiveImageValue
    preset: PresetName
    densityDissipation: number
    velocityDissipation: number
    pressureDissipation: number
    curl: number
    radius: number
    displacement: number
    splatForce: number
    autoFlow: boolean
    autoFlowSpeed: number
    pointerStrength: number
    quality: "Low" | "Medium" | "High"
    imageMix: number
}) {
    const containerRef = useRef<HTMLDivElement>(null)
    const isStatic = useIsStaticRenderer()
    const reducedMotion = useReducedMotion()
    const imageURL = getImageURL(image)
    const imageBURL = getImageURL(imageB) || imageURL

    useEffect(() => {
        const container = containerRef.current
        if (!container || isStatic || reducedMotion || !imageURL) return

        const config: FluidConfig = {
            ...DEFAULT_CONFIG,
            densityDissipation,
            velocityDissipation,
            pressureDissipation,
            curl,
            radius,
            displacement,
            splatForce,
            autoFlow,
            autoFlowSpeed,
            pointerStrength,
            ...(preset !== "Custom" ? PRESETS[preset] : {}),
        }

        let destroyed = false
        let simW = 160
        let simH = 160

        const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: "high-performance", preserveDrawingBuffer: false })
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, quality === "High" ? 2 : quality === "Medium" ? 1.5 : 1))
        renderer.autoClear = false
        renderer.setClearColor(0x000000, 1)
        container.appendChild(renderer.domElement)
        const canvas = renderer.domElement
        const camera = new THREE.Camera()
        const scene = new THREE.Scene()
        const geometry = new THREE.PlaneGeometry(2, 2)
        const mesh = new THREE.Mesh(geometry)
        mesh.frustumCulled = false
        scene.add(mesh)
        const textureLoader = new THREE.TextureLoader()
        textureLoader.setCrossOrigin("anonymous")
        const imageTexture = textureLoader.load(imageURL)
        const imageTextureB = textureLoader.load(imageBURL)
        for (const texture of [imageTexture, imageTextureB]) { texture.minFilter = THREE.LinearFilter; texture.magFilter = THREE.LinearFilter; texture.wrapS = THREE.ClampToEdgeWrapping; texture.wrapT = THREE.ClampToEdgeWrapping }

        const getSimulationSize = () => {
            const width = Math.max(container.clientWidth, 1)
            const height = Math.max(container.clientHeight, 1)
            const aspect = width / height
            const resolution = quality === "High" ? SIM_RESOLUTION : quality === "Medium" ? 128 : 96
            if (aspect >= 1) { simW = Math.max(32, Math.round(resolution * aspect)); simH = resolution }
            else { simW = resolution; simH = Math.max(32, Math.round(resolution / aspect)) }
        }
        getSimulationSize()
        const texelSize = new THREE.Vector2(1 / simW, 1 / simH)
        const rtOptions: THREE.RenderTargetOptions = { type: THREE.HalfFloatType, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false, stencilBuffer: false, wrapS: THREE.ClampToEdgeWrapping, wrapT: THREE.ClampToEdgeWrapping }
        const makeRT = () => new THREE.WebGLRenderTarget(simW, simH, rtOptions)
        const makeDouble = () => { let read = makeRT(); let write = makeRT(); return { get read(){return read}, get write(){return write}, swap(){const temp=read;read=write;write=temp}, dispose(){read.dispose();write.dispose()} } }
        const velocity = makeDouble(), dye = makeDouble(), pressure = makeDouble(), divergence = makeRT(), curlRT = makeRT()
        const createMaterial = (vertexShader: string, fragmentShader: string, uniforms: Record<string, THREE.IUniform>) => new THREE.RawShaderMaterial({ vertexShader, fragmentShader, uniforms, depthTest: false, depthWrite: false, transparent: false })
        const splatMat = createMaterial(BASE_VERTEX, SPLAT_FRAG, {uTarget:{value:null},aspectRatio:{value:simW/simH},color:{value:new THREE.Vector3()},point:{value:new THREE.Vector2()},radius:{value:config.radius}})
        const advectionMat = createMaterial(BASE_VERTEX, ADVECTION_FRAG, {uVelocity:{value:null},uSource:{value:null},texelSize:{value:texelSize},dt:{value:0},dissipation:{value:1}})
        const curlMat = createMaterial(STENCIL_VERTEX, CURL_FRAG, {texelSize:{value:texelSize},uVelocity:{value:null}})
        const vorticityMat = createMaterial(STENCIL_VERTEX, VORTICITY_FRAG, {texelSize:{value:texelSize},uVelocity:{value:null},uCurl:{value:null},curl:{value:config.curl},dt:{value:0}})
        const divergenceMat = createMaterial(STENCIL_VERTEX, DIVERGENCE_FRAG, {texelSize:{value:texelSize},uVelocity:{value:null}})
        const clearMat = createMaterial(BASE_VERTEX, CLEAR_FRAG, {uTexture:{value:null},value:{value:1}})
        const pressureMat = createMaterial(STENCIL_VERTEX, PRESSURE_FRAG, {texelSize:{value:texelSize},uPressure:{value:null},uDivergence:{value:null}})
        const gradientMat = createMaterial(STENCIL_VERTEX, GRADIENT_FRAG, {texelSize:{value:texelSize},uPressure:{value:null},uVelocity:{value:null}})
        const displayMat = createMaterial(BASE_VERTEX, DISPLAY_FRAG, {uImage:{value:imageTexture},uImageB:{value:imageTextureB},uDye:{value:null},resolution:{value:new THREE.Vector2()},uImageResolution:{value:new THREE.Vector2(1,1)},uImageResolutionB:{value:new THREE.Vector2(1,1)},uDisplacement:{value:config.displacement},uImageMix:{value:imageMix}})
        const blit = (material: THREE.Material, target: THREE.WebGLRenderTarget | null) => { if (destroyed) return; mesh.material=material; renderer.setRenderTarget(target); renderer.render(scene,camera) }
        type Splat={x:number;y:number;dx:number;dy:number}
        const queue:Splat[]=[]
        let pointer:{x:number;y:number}|null=null
        let lastInteraction=-Infinity
        let shaderTime=0
        let last=performance.now()
        const onPointerMove=(event:PointerEvent)=>{const rect=canvas.getBoundingClientRect();if(!rect.width||!rect.height)return;const x=(event.clientX-rect.left)/rect.width;const y=1-(event.clientY-rect.top)/rect.height;if(pointer)queue.push({x,y,dx:(x-pointer.x)*config.pointerStrength,dy:(y-pointer.y)*config.pointerStrength});pointer={x,y};lastInteraction=shaderTime}
        const onPointerLeave=()=>{pointer=null}
        canvas.addEventListener("pointermove",onPointerMove,{passive:true});canvas.addEventListener("pointerleave",onPointerLeave)
        let autoPrevious:{x:number;y:number}|null=null
        const pushAutoSplat=()=>{const t=shaderTime*0.6*config.autoFlowSpeed;const x=0.5+0.32*Math.sin(t*1.1);const y=0.5+0.28*Math.cos(t*1.7);if(autoPrevious)queue.push({x,y,dx:(x-autoPrevious.x)*config.pointerStrength,dy:(y-autoPrevious.y)*config.pointerStrength});autoPrevious={x,y}}
        const applySplat=(splat:Splat)=>{splatMat.uniforms.uTarget.value=velocity.read.texture;(splatMat.uniforms.point.value as THREE.Vector2).set(splat.x,splat.y);(splatMat.uniforms.color.value as THREE.Vector3).set(splat.dx*config.splatForce,splat.dy*config.splatForce,0);splatMat.uniforms.radius.value=config.radius;blit(splatMat,velocity.write);velocity.swap();splatMat.uniforms.uTarget.value=dye.read.texture;blit(splatMat,dye.write);dye.swap()}
        const step=(dt:number)=>{curlMat.uniforms.uVelocity.value=velocity.read.texture;blit(curlMat,curlRT);vorticityMat.uniforms.uVelocity.value=velocity.read.texture;vorticityMat.uniforms.uCurl.value=curlRT.texture;vorticityMat.uniforms.curl.value=config.curl;vorticityMat.uniforms.dt.value=dt;blit(vorticityMat,velocity.write);velocity.swap();divergenceMat.uniforms.uVelocity.value=velocity.read.texture;blit(divergenceMat,divergence);clearMat.uniforms.uTexture.value=pressure.read.texture;clearMat.uniforms.value.value=Math.pow(config.pressureDissipation,dt*60);blit(clearMat,pressure.write);pressure.swap();for(let i=0;i<PRESSURE_ITERATIONS;i++){pressureMat.uniforms.uPressure.value=pressure.read.texture;pressureMat.uniforms.uDivergence.value=divergence.texture;blit(pressureMat,pressure.write);pressure.swap()}gradientMat.uniforms.uPressure.value=pressure.read.texture;gradientMat.uniforms.uVelocity.value=velocity.read.texture;blit(gradientMat,velocity.write);velocity.swap();advectionMat.uniforms.uVelocity.value=velocity.read.texture;advectionMat.uniforms.uSource.value=velocity.read.texture;advectionMat.uniforms.dt.value=dt;advectionMat.uniforms.dissipation.value=Math.pow(config.velocityDissipation,dt*60);blit(advectionMat,velocity.write);velocity.swap();advectionMat.uniforms.uVelocity.value=velocity.read.texture;advectionMat.uniforms.uSource.value=dye.read.texture;advectionMat.uniforms.dissipation.value=Math.pow(config.densityDissipation,dt*60);blit(advectionMat,dye.write);dye.swap()}
        const updateImageResolution=(texture:THREE.Texture,target:THREE.Vector2)=>{const source=texture.image as {width?:number;height?:number}|undefined;if(source&&source.width&&source.height)target.set(source.width,source.height)}
        const renderFrame=()=>{if(destroyed)return;const now=performance.now();const dt=Math.min((now-last)/1000,1/30);last=now;shaderTime+=dt;updateImageResolution(imageTexture,displayMat.uniforms.uImageResolution.value);updateImageResolution(imageTextureB,displayMat.uniforms.uImageResolutionB.value);if(config.autoFlow&&shaderTime-lastInteraction>1.2)pushAutoSplat();while(queue.length){const item=queue.shift();if(item)applySplat(item)}step(0.016);displayMat.uniforms.uDye.value=dye.read.texture;displayMat.uniforms.uDisplacement.value=config.displacement;displayMat.uniforms.uImageMix.value=imageMix;blit(displayMat,null)}
        const resize=()=>{const width=container.clientWidth,height=container.clientHeight;if(!width||!height)return;renderer.setSize(width,height,false);displayMat.uniforms.resolution.value.set(renderer.domElement.width,renderer.domElement.height);renderFrame()}
        resize()
        const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(container)
        let visible=true
        const intersectionObserver=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;last=performance.now()},{rootMargin:"150px",threshold:0});intersectionObserver.observe(container)
        const onContextLost=(event:Event)=>{event.preventDefault()}
        canvas.addEventListener("webglcontextlost",onContextLost,false)
        let raf=0
        const animate=()=>{if(destroyed)return;raf=requestAnimationFrame(animate);if(!visible)return;renderFrame()}
        animate()
        return()=>{destroyed=true;cancelAnimationFrame(raf);resizeObserver.disconnect();intersectionObserver.disconnect();canvas.removeEventListener("pointermove",onPointerMove);canvas.removeEventListener("pointerleave",onPointerLeave);canvas.removeEventListener("webglcontextlost",onContextLost);if(canvas.parentNode===container)container.removeChild(canvas);velocity.dispose();dye.dispose();pressure.dispose();divergence.dispose();curlRT.dispose();imageTexture.dispose();imageTextureB.dispose();geometry.dispose();splatMat.dispose();advectionMat.dispose();curlMat.dispose();vorticityMat.dispose();divergenceMat.dispose();clearMat.dispose();pressureMat.dispose();gradientMat.dispose();displayMat.dispose();renderer.setRenderTarget(null);renderer.dispose()}
    }, [imageURL,imageBURL,preset,densityDissipation,velocityDissipation,pressureDissipation,curl,radius,displacement,splatForce,autoFlow,autoFlowSpeed,pointerStrength,quality,imageMix,isStatic,reducedMotion])

    if (isStatic || reducedMotion || !imageURL) return <div ref={containerRef} style={{width:"100%",height:"100%",overflow:"hidden",position:"relative",background:"#000"}}>{imageURL?<img src={imageURL} srcSet={typeof image==="object"&&image&&"srcSet" in image?image.srcSet:undefined} alt={typeof image==="object"&&image&&"alt" in image?image.alt||"":""} style={{width:"100%",height:"100%",display:"block",objectFit:"cover"}}/>:null}</div>
    return <div ref={containerRef} style={{width:"100%",height:"100%",overflow:"hidden",position:"relative",touchAction:"none"}} />
}

export default function KarimSaifFluidImageFlow(props:{image?:ResponsiveImageValue;imageB?:ResponsiveImageValue;preset?:PresetName;densityDissipation?:number;velocityDissipation?:number;pressureDissipation?:number;curl?:number;radius?:number;displacement?:number;splatForce?:number;autoFlow?:boolean;autoFlowSpeed?:number;pointerStrength?:number;quality?:"Low"|"Medium"|"High";imageMix?:number;style?:React.CSSProperties}) {
    const {image,imageB,preset="Fluid",densityDissipation=0.94,velocityDissipation=0.98,pressureDissipation=0.8,curl=12,radius=0.002,displacement=0.4,splatForce=6,autoFlow=true,autoFlowSpeed=1,pointerStrength=1,quality="Medium",imageMix=0,style}=props
    return <div style={{width:"100%",height:"100%",position:"relative",overflow:"hidden",...style}}><FluidImageCanvas image={image||{src:"https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=1600&q=85"}} imageB={imageB||{src:"https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=1600&q=85"}} preset={preset} densityDissipation={densityDissipation} velocityDissipation={velocityDissipation} pressureDissipation={pressureDissipation} curl={curl} radius={radius} displacement={displacement} splatForce={splatForce} autoFlow={autoFlow} autoFlowSpeed={autoFlowSpeed} pointerStrength={pointerStrength} quality={quality} imageMix={imageMix}/></div>
}

KarimSaifFluidImageFlow.defaultProps={image:{src:"https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=1600&q=85"},imageB:{src:"https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=1600&q=85"},preset:"Fluid",densityDissipation:0.94,velocityDissipation:0.98,pressureDissipation:0.8,curl:12,radius:0.002,displacement:0.4,splatForce:6,autoFlow:true,autoFlowSpeed:1,pointerStrength:1,quality:"Medium",imageMix:0}

addPropertyControls(KarimSaifFluidImageFlow,{image:{type:ControlType.ResponsiveImage,title:"Image A",description:"The starting image displayed before the fluid interaction."},imageB:{type:ControlType.ResponsiveImage,title:"Image B",description:"The second image that flows into view through the fluid simulation."},preset:{type:ControlType.Enum,title:"Preset",description:"Choose a ready-made fluid behavior or select Custom to control every simulation parameter.",options:["Soft","Fluid","Energetic","Liquid","Custom"],optionTitles:["Soft","Fluid","Energetic","Liquid","Custom"],defaultValue:"Fluid"},quality:{type:ControlType.Enum,title:"Quality",description:"Controls the internal fluid simulation resolution. Higher quality produces finer fluid detail and uses more GPU power.",options:["Low","Medium","High"],optionTitles:["Low","Medium","High"],defaultValue:"Medium",displaySegmentedControl:true},imageMix:{type:ControlType.Number,title:"Image Mix",description:"Controls the base blend between Image A and Image B before fluid displacement takes effect.",min:0,max:1,step:0.01,defaultValue:0},displacement:{type:ControlType.Number,title:"Displacement",description:"Controls how strongly the fluid velocity distorts the two images.",min:0,max:1,step:0.01,defaultValue:0.4,hidden:props=>props.preset!=="Custom"},curl:{type:ControlType.Number,title:"Curl",description:"Controls the rotational force of the fluid. Higher values create stronger swirling motion.",min:0,max:40,step:0.5,defaultValue:12,hidden:props=>props.preset!=="Custom"},splatForce:{type:ControlType.Number,title:"Force",description:"Controls how strongly pointer movement injects velocity and dye into the simulation.",min:1,max:20,step:0.5,defaultValue:6,hidden:props=>props.preset!=="Custom"},radius:{type:ControlType.Number,title:"Radius",description:"Controls the size of each fluid injection. Smaller values create tighter streams while larger values create broader movement.",min:0.0005,max:0.01,step:0.0005,defaultValue:0.002,hidden:props=>props.preset!=="Custom"},densityDissipation:{type:ControlType.Number,title:"Dye Dissipation",description:"Controls how quickly the visible fluid trail fades. Higher values keep the flow visible for longer.",min:0.8,max:1,step:0.005,defaultValue:0.94,hidden:props=>props.preset!=="Custom"},velocityDissipation:{type:ControlType.Number,title:"Velocity Dissipation",description:"Controls how quickly fluid velocity loses energy. Higher values create longer-lasting movement.",min:0.8,max:1,step:0.005,defaultValue:0.98,hidden:props=>props.preset!=="Custom"},pressureDissipation:{type:ControlType.Number,title:"Pressure Dissipation",description:"Controls how quickly pressure information fades during the fluid solve.",min:0.5,max:1,step:0.01,defaultValue:0.8,hidden:props=>props.preset!=="Custom"},pointerStrength:{type:ControlType.Number,title:"Pointer Strength",description:"Multiplies the velocity generated by cursor or touch movement.",min:0,max:2,step:0.05,defaultValue:1,hidden:props=>props.preset!=="Custom"},autoFlow:{type:ControlType.Boolean,title:"Auto Flow",description:"Automatically generates fluid movement when the user stops interacting with the component.",defaultValue:true,enabledTitle:"On",disabledTitle:"Off",hidden:props=>props.preset!=="Custom"},autoFlowSpeed:{type:ControlType.Number,title:"Auto Speed",description:"Controls the speed of the automatic fluid movement.",min:0.1,max:2,step:0.05,defaultValue:1,hidden:props=>props.preset!=="Custom"||props.autoFlow===false}})
