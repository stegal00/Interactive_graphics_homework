import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

export let scene, camera, clock, renderer, controls;
export const pokemonModels = {};
export let rainParticles;
export let sunbeamGroup;

let magnemiteModel, jigglypuffModel;
let magnemiteInitialY;
let jigglypuffInitialScale;

let currentRainPulse = false;
let rainPulseEndTime = 0;
let lastTime = 0;

const arenaWidth = 200;
const arenaDepth = 120;

function initThreeJS() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    renderer = new THREE.WebGLRenderer({ antialias: true });
    clock = new THREE.Clock();

    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    document.body.appendChild(renderer.domElement);

    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    const textureLoader = new THREE.TextureLoader();
    const groundTexture = textureLoader.load('arena_pokemon.jpg');
    const groundGeometry = new THREE.PlaneGeometry(arenaWidth, arenaDepth);
    const groundMaterial = new THREE.MeshStandardMaterial({ map: groundTexture, side: THREE.DoubleSide });
    const battlefield = new THREE.Mesh(groundGeometry, groundMaterial);
    battlefield.rotation.x = -Math.PI / 2;
    battlefield.receiveShadow = true;
    scene.add(battlefield);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.9);
    directionalLight.position.set(10, 30, 20);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 100;
    directionalLight.shadow.camera.left = -arenaWidth / 1.8;
    directionalLight.shadow.camera.right = arenaWidth / 1.8;
    directionalLight.shadow.camera.top = arenaDepth / 1.8;
    directionalLight.shadow.camera.bottom = -arenaDepth / 1.8;

    camera.position.set(0, 20, 40);
    controls.target.set(0, 2, 0);

    scene.userData.ambientLight = ambientLight;
    scene.userData.directionalLight = directionalLight;
}

function createStadiumWalls() {
    const textureLoader = new THREE.TextureLoader();
    const wallTexture = textureLoader.load('./tifosi.jpg');
    const wallMaterial = new THREE.MeshBasicMaterial({
        map: wallTexture,
        side: THREE.DoubleSide
    });

    const wallHeight = 60;

    const frontWallGeo = new THREE.PlaneGeometry(arenaWidth, wallHeight);
    const frontWall = new THREE.Mesh(frontWallGeo, wallMaterial);
    frontWall.position.set(0, wallHeight / 2, arenaDepth / 2);
    scene.add(frontWall);

    const backWallGeo = new THREE.PlaneGeometry(arenaWidth, wallHeight);
    const backWall = new THREE.Mesh(backWallGeo, wallMaterial);
    backWall.position.set(0, wallHeight / 2, -arenaDepth / 2);
    scene.add(backWall);

    const leftWallGeo = new THREE.PlaneGeometry(arenaDepth, wallHeight);
    const leftWall = new THREE.Mesh(leftWallGeo, wallMaterial);
    leftWall.position.set(-arenaWidth / 2, wallHeight / 2, 0);
    leftWall.rotation.y = Math.PI / 2;
    scene.add(leftWall);

    const rightWallGeo = new THREE.PlaneGeometry(arenaDepth, wallHeight);
    const rightWall = new THREE.Mesh(rightWallGeo, wallMaterial);
    rightWall.position.set(arenaWidth / 2, wallHeight / 2, 0);
    rightWall.rotation.y = -Math.PI / 2;
    scene.add(rightWall);
}

function createStadiumRoof() {
    const textureLoader = new THREE.TextureLoader();
    const roofTexture = textureLoader.load('./tetto.png');
    const roofGeometry = new THREE.PlaneGeometry(arenaWidth, arenaDepth);
    const roofMaterial = new THREE.MeshBasicMaterial({
        map: roofTexture,
        side: THREE.DoubleSide
    });
    const roof = new THREE.Mesh(roofGeometry, roofMaterial);
    roof.position.set(0, 60, 0);
    roof.rotation.x = -Math.PI / 2;
    scene.add(roof);
}

function loadPokemonModel(modelPath, pokemonKey, position, scaleFactor, textureConfig, rotationY, loader, onModelLoaded) {
    loader.load(modelPath, (object) => {

        object.scale.set(scaleFactor, scaleFactor, scaleFactor);
        object.position.copy(position);
        object.rotation.y = rotationY;
        object.visible = false;

        pokemonModels[pokemonKey] = object;

        if (pokemonKey === 'magnemite') {
            magnemiteModel = object;
            magnemiteInitialY = object.position.y;
        } else if (pokemonKey === 'jigglypuff') {
            jigglypuffModel = object;
            jigglypuffInitialScale = object.scale.clone();
        }

        const textureLoader = new THREE.TextureLoader();
        object.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                let materialApplied = false;
                if (textureConfig && textureConfig.parts) {
                    for (const partConfig of textureConfig.parts) {
                        if (child.name.toLowerCase().includes(partConfig.nameMatch.toLowerCase())) {
                            const material = new THREE.MeshStandardMaterial();
                            if (partConfig.albedo) material.map = textureLoader.load(partConfig.albedo);
                            material.metalness = partConfig.metalnessValue !== undefined ? partConfig.metalnessValue : 0.5;
                            material.roughness = partConfig.roughnessValue !== undefined ? partConfig.roughnessValue : 0.5;
                            child.material = material;
                            materialApplied = true;
                            break;
                        }
                    }
                }
                if (!materialApplied && textureConfig && textureConfig.fallbackColor) {
                    child.material = new THREE.MeshStandardMaterial({ color: textureConfig.fallbackColor });
                } else if (!child.material) {
                    child.material = new THREE.MeshStandardMaterial({ color: 0x888888 });
                }
            }
        });
        
        scene.add(object);
        onModelLoaded();
    });
}

function createSunbeams() {
    sunbeamGroup = new THREE.Group();
    const numBeams = 12;

    for (let i = 0; i < numBeams; i++) {
        const height = 80;
        const radius = Math.random() * 2.5 + 1.5;
        const geo = new THREE.CylinderGeometry(radius, radius * 0.7, height, 16, 1, true);
        
        const mat = new THREE.MeshBasicMaterial({
            color: 0xFFFF99,
            transparent: true,
            opacity: 0.2,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        const beam = new THREE.Mesh(geo, mat);

        const angle = Math.random() * Math.PI * 2;
        const x = Math.cos(angle) * (Math.random() * 40 + 20);
        const z = Math.sin(angle) * (Math.random() * 40 + 20);
        beam.position.set(x, height / 2, z);
        beam.lookAt(new THREE.Vector3(0, 0, 0));
        sunbeamGroup.add(beam);
    }

    sunbeamGroup.visible = false;
    scene.add(sunbeamGroup);
}

export function setupScene(onAllModelsLoaded) {
    initThreeJS();
    createStadiumWalls();
    createStadiumRoof();

    const fbxLoader = new FBXLoader();
    let modelsLoaded = 0;
    const totalModels = 2;

    const modelLoadedCallback = () => {
        modelsLoaded++;
        if (modelsLoaded === totalModels) {
            onAllModelsLoaded();
        }
    };

    const magnemiteTexturePath = './modelli/magnemite/textures/';
    loadPokemonModel('./modelli/magnemite/source/magnemite.fbx', 'magnemite', new THREE.Vector3(-25, 5, 0), 0.025, {
        parts: [
            { nameMatch: 'psphere8', albedo: magnemiteTexturePath + 'eye_albedo.jpeg' },
            { nameMatch: 'pcylinder', albedo: magnemiteTexturePath + 'magnet_albedo.jpeg' },
            { nameMatch: 'phelix', albedo: magnemiteTexturePath + 'screw_albedo.jpeg' },
            { nameMatch: 'polysurface', albedo: magnemiteTexturePath + 'body_albedo.jpeg' }
        ], fallbackColor: 0xB0B0B0
    }, -3 * Math.PI / 2, fbxLoader, modelLoadedCallback);
    
    loadPokemonModel('./modelli/jigglypuff/source/body_open.fbx', 'jigglypuff', new THREE.Vector3(25, 0.1, 0), 0.03, {
        parts: [{ nameMatch: 'body_open', albedo: './modelli/jigglypuff/textures/gf_open_B.png', roughnessValue: 0.8, metalnessValue: 0.1 }],
        fallbackColor: 0xFFC0CB
    }, 3 * Math.PI / 2, fbxLoader, modelLoadedCallback);

    createRain();
    createSunbeams();
}

export function createRain() {
    const particleCount = 1500;
    const initialYRange = { min: 30, max: 45 }; 

    const vertices = [];
    for (let i = 0; i < particleCount; i++) {
        const x = THREE.MathUtils.randFloatSpread(arenaWidth);
        const y = THREE.MathUtils.randFloat(initialYRange.min, initialYRange.max);
        const z = THREE.MathUtils.randFloatSpread(arenaDepth);
        vertices.push(x, y, z);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.userData = { initialYRange: initialYRange };
    const material = new THREE.PointsMaterial({
        color: 0x6495ED, size: 0.35, transparent: true, opacity: 0.75, depthWrite: false 
    });

    rainParticles = new THREE.Points(geometry, material);
    rainParticles.visible = false; 
    scene.add(rainParticles);
}

export function triggerRainTurnEffect() {
    if (currentRainPulse || !rainParticles) return;

    currentRainPulse = true;
    rainPulseEndTime = clock.getElapsedTime() + 2.0;

    const positions = rainParticles.geometry.attributes.position.array;
    const initialYRange = rainParticles.geometry.userData.initialYRange;
    if (positions && initialYRange) {
        for (let i = 0; i < positions.length; i += 3) {
            positions[i] = THREE.MathUtils.randFloatSpread(arenaWidth);
            positions[i + 1] = THREE.MathUtils.randFloat(initialYRange.min, initialYRange.max);
            positions[i + 2] = THREE.MathUtils.randFloatSpread(arenaDepth);
        }
        rainParticles.geometry.attributes.position.needsUpdate = true;
    }
    
    rainParticles.visible = true;
}

export function triggerLightBeamEffect(position, isDespawn = false) {
    return new Promise(resolve => {
        const beamRadius = 4;
        const beamHeight = 50;
        const beamGeo = new THREE.CylinderGeometry(beamRadius, beamRadius * 0.5, beamHeight, 32, 1, true);
        const beamMat = new THREE.MeshBasicMaterial({
            color: 0xFFFFFF,
            transparent: true,
            opacity: 0.8,
            side: THREE.DoubleSide
        });
        const beam = new THREE.Mesh(beamGeo, beamMat);

        const startY = isDespawn ? 0 : beamHeight / 2;
        const endY = isDespawn ? beamHeight / 2 : 0;       
        beam.position.set(position.x, startY, position.z);
        scene.add(beam);

        const duration = 1.5;
        const startTime = clock.getElapsedTime();
        function animateBeam() {
            const elapsed = clock.getElapsedTime() - startTime;
            const t = Math.min(1, elapsed / duration);            
            beam.position.y = THREE.MathUtils.lerp(startY, endY, t);
            beam.material.opacity = 0.8 * (1 - t);
            if (t < 1) {
                requestAnimationFrame(animateBeam);
            } else {
                scene.remove(beam);
                beamGeo.dispose();
                beamMat.dispose();
                resolve();
            }
        }
        animateBeam();
    });
}

export function spawnPokemonAnimation(pokemonKey) {
    return new Promise(resolve => {
        const model = pokemonModels[pokemonKey];
        if (!model) return resolve();       
        triggerLightBeamEffect(model.position, false);
        model.visible = true;
        model.scale.set(0.001, 0.001, 0.001); 
        model.traverse(child => {
            if (child.isMesh) {
                child.material.transparent = true;
                child.material.opacity = 0;
            }
        });
        
        const duration = 2.0;
        const startTime = clock.getElapsedTime();
        function animateSpawn() {
            const elapsed = clock.getElapsedTime() - startTime;
            const t = Math.min(1, elapsed / duration);            
            const finalScale = pokemonKey === 'magnemite' ? 0.025 : 0.03;
            const currentScale = finalScale * t;
            model.scale.set(currentScale, currentScale, currentScale);
            model.traverse(child => {
                if (child.isMesh) {
                    child.material.opacity = t;
                }
            });
            if (t < 1) {
                requestAnimationFrame(animateSpawn);
            } else {
                const finalScale = pokemonKey === 'magnemite' ? 0.025 : 0.03;
                model.scale.set(finalScale, finalScale, finalScale);
                 model.traverse(child => {
                    if (child.isMesh) {
                        child.material.opacity = 1;
                        child.material.transparent = false;
                    }
                });
                resolve();
            }
        }
        animateSpawn();
    });
}

export function animate() {
    requestAnimationFrame(animate);

    const elapsedTime = clock.getElapsedTime();
    const deltaTime = elapsedTime - lastTime;
    lastTime = elapsedTime;

    if (magnemiteModel && magnemiteModel.visible && magnemiteInitialY !== undefined) {
        magnemiteModel.position.y = magnemiteInitialY + Math.sin(elapsedTime * 2) * 0.5;
    }
    if (jigglypuffModel && jigglypuffModel.visible && jigglypuffInitialScale) {
        const scaleMultiplier = 1 + Math.sin(elapsedTime * 1.7) * 0.03;
        jigglypuffModel.scale.copy(jigglypuffInitialScale).multiplyScalar(scaleMultiplier);
        jigglypuffModel.rotation.y += Math.sin(elapsedTime * 0.5) * 0.001;
    }

    if (currentRainPulse && rainParticles && rainParticles.visible) {
        if (elapsedTime < rainPulseEndTime) {
            const positions = rainParticles.geometry.attributes.position.array;
            const rainSpeed = 40;
            const initialYRange = rainParticles.geometry.userData.initialYRange;
            const groundLevel = -5;            
            if (deltaTime > 0) {
                for (let i = 0; i < positions.length; i += 3) {
                    positions[i + 1] -= rainSpeed * deltaTime;
                    if (positions[i + 1] < groundLevel) {
                        positions[i] = THREE.MathUtils.randFloatSpread(arenaWidth);
                        positions[i + 1] = THREE.MathUtils.randFloat(initialYRange.min, initialYRange.max);
                        positions[i + 2] = THREE.MathUtils.randFloatSpread(arenaDepth);
                    }
                }
                rainParticles.geometry.attributes.position.needsUpdate = true;
            }
        } else {
            rainParticles.visible = false;
            currentRainPulse = false;
        }
    }
    
    if (sunbeamGroup && sunbeamGroup.visible) {
        const time = elapsedTime * 2;
        sunbeamGroup.children.forEach((beam, index) => {
            beam.material.opacity = 0.15 + (Math.sin(time + index) + 1) / 2 * 0.1;
        });
    }

    controls.update();
    renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
    if (camera && renderer) {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }
});