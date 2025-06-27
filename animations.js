import * as THREE from 'three';

let sceneRef;
let clockRef;
let cameraRef;
let pokemonModelsRef;

const moveSounds = {
    'Sing': 'suoni/canto.mp3',
    'Flamethrower': 'suoni/fuoco_sole.mp3',
    'Echoing-voice': 'suoni/eccheggiavoce.mp3',
    'Electroball': 'suoni/elettrico.mp3',
    'Rapid-spin': 'suoni/girorapido.mp3',
    'Cannon-flash': 'suoni/metallico.mp3',
    'sleep': 'suoni/russare.mp3',
    'Raindance': 'suoni/rain.mp3',
    'SunnyDay': 'suoni/fuoco_sole.mp3'
};

export function initAnimations(scene, clock, camera, pokemonModels) {
    sceneRef = scene;
    clockRef = clock;
    cameraRef = camera;
    pokemonModelsRef = pokemonModels;
}

export async function triggerAttackAnimation(attackerName, moveKey) {
    return new Promise(async resolve => {
        const attacker = pokemonModelsRef[attackerName];
        const defenderName = attackerName === 'magnemite' ? 'jigglypuff' : 'magnemite';
        const defender = pokemonModelsRef[defenderName];

        const soundPath = moveSounds[moveKey];
        let sound = null;
        if (soundPath) {
            sound = new Audio(soundPath);
        }
        
        const cleanupAndResolve = () => {
            if (sound) {
                sound.pause();
                sound.currentTime = 0;
            }
            resolve();
        };

        if (!attacker) {
            console.warn(`Attacker model ${attackerName} not found for animation.`);
            return resolve();
        }

        const attackerHeightOffset = attackerName === 'magnemite' ? 2 : 1;
        const defenderHeightOffset = defenderName === 'magnemite' ? 2 : 1;

        const startPos = attacker.position.clone().add(new THREE.Vector3(0, attackerHeightOffset, 0));
        const endPos = defender ? defender.position.clone().add(new THREE.Vector3(0, defenderHeightOffset, 0)) : null;

        switch (moveKey) {
            case 'sleep': {
                const snoreSound = new Audio('suoni/russare.mp3');
                snoreSound.volume = 1.0;
                snoreSound.loop = true;
                snoreSound.play().catch(e => console.error("Sound play error:", e));

                const attackerBox = new THREE.Box3().setFromObject(attacker);
                const attackerHeight = attackerBox.max.y - attackerBox.min.y;
                const baseOffset = attackerHeight > 0 ? attackerHeight : 2;

                for (let i = 0; i < 3; i++) {
                    setTimeout(() => {
                        const canvas = document.createElement('canvas');
                        canvas.width = 64; canvas.height = 64;
                        const context = canvas.getContext('2d');
                        context.font = "bold 40px Arial";
                        context.fillStyle = "#4169E1"; context.strokeStyle = "white";
                        context.lineWidth = 2; context.textAlign = "center";
                        context.textBaseline = "middle";
                        context.strokeText("Zzz", 32, 32); context.fillText("Zzz", 32, 32);
                        const texture = new THREE.CanvasTexture(canvas);

                        const mat = new THREE.SpriteMaterial({
                            map: texture, transparent: true, sizeAttenuation: false, depthTest: false
                        });
                        const sprite = new THREE.Sprite(mat);
                        sprite.scale.set(0.15, 0.15, 0.15);
                        const offset = new THREE.Vector3((Math.random() - 0.5) * 2, baseOffset + (i * 0.8), (Math.random() - 0.5) * 1);
                        sprite.position.copy(attacker.position).add(offset);
                        sceneRef.add(sprite);

                        const zzDuration = 1.5 + i * 0.3;
                        const zzStartTime = clockRef.getElapsedTime() + i * 0.3;
                        function animateZZZ() {
                            const t = (clockRef.getElapsedTime() - zzStartTime) / zzDuration;
                            if (t >= 0 && t < 1) {
                                sprite.position.y = attacker.position.y + offset.y + t * 2;
                                sprite.material.opacity = Math.max(0, 1 - t);
                                sprite.scale.setScalar(0.15 + t * 0.1);
                                requestAnimationFrame(animateZZZ);
                            } else if (t >= 1) {
                                sceneRef.remove(sprite);
                                texture.dispose();
                                mat.dispose();
                            } else { requestAnimationFrame(animateZZZ); }
                        }
                        animateZZZ();
                    }, i * 500);
                }

                setTimeout(() => {
                    snoreSound.pause();
                    snoreSound.currentTime = 0;
                    resolve();
                }, 2500);
                break;
            }
            
            case 'Flamethrower':
                if (sound) {
                    sound.loop = true;
                    sound.play().catch(e => console.error("Sound play error:", e));
                }

                if (!endPos) return cleanupAndResolve();

                const duration = 3.0;
                const particleCount = 1000;
                const particles = [];
                const colors = [0xFF4500, 0xFFA500, 0xFFD700];
                const direction = new THREE.Vector3().subVectors(endPos, startPos);
                const distance = direction.length();
                direction.normalize();

                for (let i = 0; i < particleCount; i++) {
                    const particleGeo = new THREE.SphereGeometry(0.15, 8, 8);
                    const particleMat = new THREE.MeshBasicMaterial({ color: colors[Math.floor(Math.random() * colors.length)], transparent: true, });
                    const particle = new THREE.Mesh(particleGeo, particleMat);
                    particle.position.copy(startPos);
                    const spread = 0.2;
                    const particleDirection = direction.clone().add(new THREE.Vector3((Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread)).normalize();
                    const speed = 20 + Math.random() * 5;
                    const life = distance / speed;
                    particles.push({ mesh: particle, direction: particleDirection, speed: speed, life: life, startTime: clockRef.getElapsedTime() + (i / particleCount) * (duration / 2) });
                    sceneRef.add(particle);
                }

                const animationStartTime = clockRef.getElapsedTime();
                function animateFlamethrower() {
                    const elapsed = clockRef.getElapsedTime() - animationStartTime;
                    if (elapsed > duration + 1) {
                        particles.forEach(p => { if (p.mesh.parent) sceneRef.remove(p.mesh); p.mesh.geometry.dispose(); p.mesh.material.dispose(); });
                        cleanupAndResolve();
                        return;
                    }
                    particles.forEach(p => {
                        const particleElapsed = clockRef.getElapsedTime() - p.startTime;
                        if (particleElapsed > 0 && p.mesh.visible) {
                            p.mesh.position.add(p.direction.clone().multiplyScalar(p.speed / 60.0));
                            const lifeRatio = particleElapsed / p.life;
                            p.mesh.material.opacity = Math.max(0, 1 - lifeRatio);
                            if (lifeRatio > 1) { p.mesh.visible = false; }
                        }
                    });
                    requestAnimationFrame(animateFlamethrower);
                }
                animateFlamethrower();
                break;
            
            case 'Cannon-flash':
                if (sound) sound.play().catch(e => console.error("Sound play error:", e));

                if (!endPos) return cleanupAndResolve();

                const flashDist = startPos.distanceTo(endPos);
                const flashDur = 1.5;

                const canvas = document.createElement('canvas');
                canvas.width = 32; canvas.height = 64;
                const context = canvas.getContext('2d');
                context.fillStyle = '#444444'; context.fillRect(0, 0, 32, 64);
                context.fillStyle = '#CCCCCC';
                for (let i = 0; i < 8; i++) { 
                    context.fillRect(0, i * 8, 32, 4); 
                }
                const beamTexture = new THREE.CanvasTexture(canvas);
                beamTexture.wrapS = THREE.RepeatWrapping; beamTexture.wrapT = THREE.RepeatWrapping;

                const orientationHelper = new THREE.Object3D();
                orientationHelper.position.copy(startPos);
                orientationHelper.lookAt(endPos);
                sceneRef.add(orientationHelper);

                const coreGeo = new THREE.CylinderGeometry(0.7, 0.7, flashDist, 16);
                const coreMat = new THREE.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true });
                const coreBeam = new THREE.Mesh(coreGeo, coreMat);
                const outerGeo = new THREE.CylinderGeometry(1.5, 1.5, flashDist, 16, 1, true);
                const outerMat = new THREE.MeshBasicMaterial({ map: beamTexture, color: 0xAAAAAA, transparent: true, side: THREE.DoubleSide, opacity: 0.6 });
                const outerBeam = new THREE.Mesh(outerGeo, outerMat);
                coreBeam.rotation.x = outerBeam.rotation.x = Math.PI / 2;
                coreBeam.position.z = outerBeam.position.z = flashDist / 2;
                orientationHelper.add(coreBeam, outerBeam);

                const flashParticles = [];
                const flashParticleCount = 50;
                const flashParticleColors = [0xCCCCCC, 0x999999, 0xFFFFFF];
                for (let i = 0; i < flashParticleCount; i++) {
                    const particleGeo = new THREE.SphereGeometry(0.08, 6, 6);
                    const particleMat = new THREE.MeshBasicMaterial({ color: flashParticleColors[Math.floor(Math.random() * flashParticleColors.length)] });
                    const particle = new THREE.Mesh(particleGeo, particleMat);
                    flashParticles.push({ mesh: particle, angle: Math.random() * Math.PI * 2, speed: 0.5 + Math.random() * 0.5, offset: Math.random() * flashDist });
                    orientationHelper.add(particle);
                }

                const flashStartTime = clockRef.getElapsedTime();
                function animateCannonFlash() {
                    const elapsed = clockRef.getElapsedTime() - flashStartTime;
                    const t = elapsed / flashDur;
                    if (t < 1) {
                        const fadeInOut = Math.sin(t * Math.PI);
                        coreMat.opacity = outerMat.opacity = fadeInOut;
                        beamTexture.offset.y -= 0.05;
                        flashParticles.forEach(p => {
                            p.angle += p.speed * 0.1;
                            p.offset = (p.offset + 0.5) % flashDist;
                            const radius = 0.6 + Math.sin(p.offset * 0.5 + p.angle) * 0.2;
                            p.mesh.position.x = Math.cos(p.angle) * radius;
                            p.mesh.position.y = Math.sin(p.angle) * radius;
                            p.mesh.position.z = p.offset;
                        });
                        requestAnimationFrame(animateCannonFlash);
                    } else {
                        sceneRef.remove(orientationHelper);
                        [coreGeo, outerGeo, ...flashParticles.map(p => p.mesh.geometry)].forEach(g => g.dispose());
                        [coreMat, outerMat, ...flashParticles.map(p => p.mesh.material)].forEach(m => m.dispose());
                        beamTexture.dispose();
                        cleanupAndResolve();
                    }
                }
                animateCannonFlash();
                break;
            
            case 'Electroball':
                if (sound) sound.play().catch(e => console.error("Sound play error:", e));

                if (!endPos) return cleanupAndResolve();

                const coreRadius = 2.5;
                const ballGeo = new THREE.SphereGeometry(coreRadius, 16, 16);
                const ballMat = new THREE.MeshBasicMaterial({ color: 0xFFFF00 });
                const ball = new THREE.Mesh(ballGeo, ballMat);
                ball.position.copy(startPos);
                sceneRef.add(ball);

                const ebDuration = 0.8;
                const sparks = [];
                const sparkLife = 0.2;
                const ebStartTime = clockRef.getElapsedTime();

                function animateElectroball() {
                    const elapsedTime = clockRef.getElapsedTime() - ebStartTime;
                    const t = elapsedTime / ebDuration;
                    if (t < 1) {
                        ball.position.lerpVectors(startPos, endPos, t);
                        const pulse = 1.0 + 0.15 * Math.sin(elapsedTime * 30);
                        ball.scale.set(pulse, pulse, pulse);
                        if (Math.random() > 0.5) {
                            const sparkGeo = new THREE.SphereGeometry(0.1, 4, 4);
                            const sparkMat = new THREE.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true });
                            const spark = new THREE.Mesh(sparkGeo, sparkMat);
                            const sparkPos = new THREE.Vector3((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2).normalize().multiplyScalar(coreRadius * pulse);
                            spark.position.copy(ball.position).add(sparkPos);
                            sparks.push({ mesh: spark, creationTime: elapsedTime });
                            sceneRef.add(spark);
                        }
                        for (let i = sparks.length - 1; i >= 0; i--) {
                            const sparkData = sparks[i];
                            const sparkAge = elapsedTime - sparkData.creationTime;
                            if (sparkAge > sparkLife) {
                                sceneRef.remove(sparkData.mesh);
                                sparkData.mesh.geometry.dispose();
                                sparkData.mesh.material.dispose();
                                sparks.splice(i, 1);
                            } else {
                                sparkData.mesh.material.opacity = 1.0 - (sparkAge / sparkLife);
                            }
                        }
                        requestAnimationFrame(animateElectroball);
                    } else {
                        sceneRef.remove(ball);
                        ballGeo.dispose();
                        ballMat.dispose();
                        sparks.forEach(s => { sceneRef.remove(s.mesh); s.mesh.geometry.dispose(); s.mesh.material.dispose(); });
                        cleanupAndResolve();
                    }
                }
                animateElectroball();
                break;
            
            case 'Rapid-spin': {
                const rotDuration = 0.8;
                const moveDuration = 0.5;
                const initialRotY = attacker.rotation.y;
                const spinStartTime = clockRef.getElapsedTime();
                await new Promise(res => {
                    function animateSpin() {
                        const t = (clockRef.getElapsedTime() - spinStartTime) / rotDuration;
                        if (t < 1) {
                            attacker.rotation.y = initialRotY + t * Math.PI * 6;
                            requestAnimationFrame(animateSpin);
                        } else {
                            attacker.rotation.y = initialRotY;
                            res();
                        }
                    }
                    animateSpin();
                });

                if (!endPos) return resolve();

                const initialPos = attacker.position.clone();
                const lungeStartTime = clockRef.getElapsedTime();
                let soundPlayed = false;
                await new Promise(res => {
                    function animateLunge() {
                        const t = (clockRef.getElapsedTime() - lungeStartTime) / moveDuration;
                        if (sound && t >= 0.5 && !soundPlayed) {
                            sound.play().catch(e => console.error("Sound play error:", e));
                            soundPlayed = true;
                        }
                        if (t < 1) {
                            if (t < 0.5) {
                                attacker.position.lerpVectors(initialPos, endPos, t * 2);
                            } else {
                                attacker.position.lerpVectors(endPos, initialPos, (t - 0.5) * 2);
                            }
                            requestAnimationFrame(animateLunge);
                        } else {
                            attacker.position.copy(initialPos);
                            res();
                        }
                    }
                    animateLunge();
                });
                resolve();
                break;
            }

            case 'Sing':
                if (sound) sound.play().catch(e => console.error("Sound play error:", e));

                for (let i = 0; i < 5; i++) {
                    const canvas = document.createElement('canvas');
                    canvas.width = 64; canvas.height = 64;
                    const context = canvas.getContext('2d');
                    context.font = "bold 48px Arial";
                    context.fillStyle = "black"; context.textAlign = "center";
                    context.textBaseline = "middle"; context.fillText("♪", 32, 32);
                    const texture = new THREE.CanvasTexture(canvas);

                    const mat = new THREE.SpriteMaterial({ map: texture, transparent: true, sizeAttenuation: false });
                    const sprite = new THREE.Sprite(mat);
                    sprite.scale.set(0.1, 0.1, 0.1);
                    const offset = new THREE.Vector3((Math.random() - 0.5) * 2, Math.random() * 2 + 6, (Math.random() - 0.5) * 2);
                    const targetPos = startPos.clone().add(offset);
                    sprite.position.copy(startPos);
                    sceneRef.add(sprite);
                    
                    const noteDuration = 1.2 + Math.random() * 0.5;
                    const noteStartTime = clockRef.getElapsedTime() + i * 0.15;
                    function animateNote() {
                        const t = (clockRef.getElapsedTime() - noteStartTime) / noteDuration;
                        if (t < 1) {
                            sprite.position.lerp(targetPos, t);
                            sprite.material.opacity = 1.0 - Math.pow(t, 2);
                            sprite.scale.set(0.1 + t * 0.1, 0.1 + t * 0.1, 0.1 + t * 0.1);
                            requestAnimationFrame(animateNote);
                        } else {
                            sceneRef.remove(sprite);
                            texture.dispose();
                            mat.dispose();
                        }
                    }
                    animateNote();
                }
                setTimeout(cleanupAndResolve, 1500);
                break;
            
            case 'Echoing-voice':
                if (sound) sound.play().catch(e => console.error("Sound play error:", e));

                const numRings = 4;
                const ringBaseDuration = 1.2;
                const delayBetweenRings = 250;

                const echoHelper = new THREE.Object3D();
                echoHelper.position.copy(startPos);
                if (endPos) { echoHelper.lookAt(endPos); } else { echoHelper.rotation.y = attacker.rotation.y; }
                sceneRef.add(echoHelper);

                for (let i = 0; i < numRings; i++) {
                    setTimeout(() => {
                        const initialOpacity = 0.8 - (i * 0.15);
                        const ringGeo = new THREE.RingGeometry(0.1, 0.2, 32);
                        const ringMat = new THREE.MeshBasicMaterial({ color: 0xA9A9F5, side: THREE.DoubleSide, transparent: true, opacity: initialOpacity });
                        const ring = new THREE.Mesh(ringGeo, ringMat);
                        ring.rotation.x = Math.PI / 2;
                        echoHelper.add(ring);
                        
                        const ringStartTime = clockRef.getElapsedTime();
                        function animateSingleRing() {
                            const elapsed = clockRef.getElapsedTime() - ringStartTime;
                            const t = elapsed / ringBaseDuration;
                            if (t < 1) {
                                const scale = t * 300;
                                ring.scale.set(scale, scale, scale);
                                const shimmer = 0.8 + Math.sin(elapsed * 50) * 0.2;
                                ring.material.opacity = (initialOpacity * (1 - t)) * shimmer;
                                requestAnimationFrame(animateSingleRing);
                            } else {
                                echoHelper.remove(ring);
                                ringGeo.dispose();
                                ringMat.dispose();
                            }
                        }
                        animateSingleRing();
                    }, i * delayBetweenRings);
                }
                const totalDuration = ringBaseDuration * 1000 + delayBetweenRings * numRings;
                setTimeout(cleanupAndResolve, totalDuration);
                break;
            
            case 'Raindance':
            case 'SunnyDay': {
                if (sound) {
                    sound.play().catch(e => console.error("Sound play error:", e));
                    setTimeout(() => {
                        if (sound) {
                            sound.pause();
                            sound.currentTime = 0;
                        }
                    }, 2500);
                }

                const initialY = attacker.position.y;
                const castDuration = 1.0;
                const jumpHeight = attackerName === 'magnemite' ? 1.5 : 1;
                const castStartTime = clockRef.getElapsedTime();

                const castPromise = new Promise(resolveCast => {
                    function animateCast() {
                        const t = (clockRef.getElapsedTime() - castStartTime) / castDuration;
                        if (t < 1) {
                            attacker.position.y = initialY + Math.sin(t * Math.PI) * jumpHeight;
                            requestAnimationFrame(animateCast);
                        } else {
                            attacker.position.y = initialY;
                            resolveCast();
                        }
                    }
                    animateCast();
                });
                await castPromise;

                resolve();
                break;
            }

            default:
                if (defender && endPos) {

                    const initialPos = attacker.position.clone();
                    const defaultMoveStartTime = clockRef.getElapsedTime();
                    const defaultMoveDuration = 0.5;
                    
                    function animateLunge() {
                        const t = (clockRef.getElapsedTime() - defaultMoveStartTime) / defaultMoveDuration;
                        if (t < 1) {
                            if (t < 0.5) attacker.position.lerpVectors(initialPos, endPos, t * 2);
                            else attacker.position.lerpVectors(endPos, initialPos, (t - 0.5) * 2);
                            requestAnimationFrame(animateLunge);
                        } else {
                            attacker.position.copy(initialPos);
                            resolve();
                        }
                    }
                    animateLunge();
                } else {
                    setTimeout(resolve, 500);
                }
                break;
        }
    });
}