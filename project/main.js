import * as THREE from 'three';
import { initGameLogic, playerSelectMove } from './gameLogic.js';
import { initAnimations, triggerAttackAnimation as importedAttackAnimation } from './animations.js';
import {
    setupScene,
    animate,
    scene,
    camera,
    clock,
    pokemonModels,
    rainParticles,
    sunbeamGroup,
    triggerRainTurnEffect as sceneTriggerRainEffect,
    spawnPokemonAnimation,
    triggerLightBeamEffect
} from './sceneManager.js';

const backgroundMusic = new Audio('musica_pokemon.mp3');
backgroundMusic.loop = true;
backgroundMusic.volume = 0.2;

let playerPokemonName = null;

let baseDirLightIntensity = 0.9;
let baseAmbLightIntensity = 0.7;
let currentSunnyDayPulse = false;

const statsPokemon = {
    magnemite: { nome: "Magnemite", hp: 65, hp_max: 65, attack: 10, defence: 15, speed: 10, mosse: ["Rapid-spin", "Electroball", "Cannon-flash", "Raindance"] },
    jigglypuff: { nome: "Jigglypuff", hp: 50, hp_max: 50, attack: 15, defence: 10, speed: 15, mosse: ["Sing", "SunnyDay", "Flamethrower", "Echoing-voice"] }
};

const movesData = {
    "Rapid-spin": { name: "Rapid-spin" }, "Electroball": { name: "Electroball" }, "Cannon-flash": { name: "Cannon-flash" }, "Raindance": { name: "Raindance" },
    "Sing": { name: "Sing" }, "SunnyDay": { name: "SunnyDay" }, "Flamethrower": { name: "Flamethrower" }, "Echoing-voice": { name: "Echoing-voice" }
};

const mainInterfaceFunctions = {
    updateHPUI: (pokemonName, newHP) => {
        const pokemonData = statsPokemon[pokemonName];
        if (!pokemonData) return;

        const hpTextElement = document.getElementById(`${pokemonName}-bar-hp-text`);
        const hpBarElement = document.getElementById(`${pokemonName}-bar-hp-inner`);
        if (hpTextElement && hpBarElement) {

            hpTextElement.innerText = newHP;

            const hpPercentage = (newHP / pokemonData.hp_max) * 100;
            hpBarElement.style.width = `${hpPercentage}%`;

            hpBarElement.classList.remove('hp-green', 'hp-orange', 'hp-red');
            if (hpPercentage > 50) hpBarElement.classList.add('hp-green');
            else if (hpPercentage > 25) hpBarElement.classList.add('hp-orange');
            else hpBarElement.classList.add('hp-red');
        }
    },

    triggerAttackAnimation: importedAttackAnimation,

    triggerDamageAnimation: (pokemonName) => {
        return new Promise(resolve => {
            const model = pokemonModels[pokemonName];
            if (!model) return resolve();
            const initialRot = model.rotation.clone();
            const duration = 0.5;
            const startTime = clock.getElapsedTime();
            let originalVisibility = {};
            model.traverse(child => {
                if(child.isMesh) originalVisibility[child.uuid] = child.visible;
            });

            function animateDamage() {
                const elapsedTime = clock.getElapsedTime() - startTime;
                const shakeProgress = elapsedTime / duration;
                if (shakeProgress < 1) {

                    model.rotation.z = initialRot.z + Math.sin(shakeProgress * Math.PI * 8) * 0.2;

                    const currentBlinkCycleTime = elapsedTime % (0.1 * 2);
                    const isVisibleInBlink = currentBlinkCycleTime < 0.1;
                    model.traverse(child => {
                        if(child.isMesh) child.visible = isVisibleInBlink;
                    });

                    requestAnimationFrame(animateDamage);
                } else {
                    
                    model.rotation.copy(initialRot);
                    model.traverse(child => {
                        if(child.isMesh && originalVisibility[child.uuid] !== undefined) child.visible = originalVisibility[child.uuid];
                        else if (child.isMesh) child.visible = true;
                    });
                    resolve();
                }
            }
            animateDamage();
        });
    },

    triggerDefeatAnimation: async (pokemonName) => {
        const model = pokemonModels[pokemonName];
        if (!model) return;

        await new Promise(resolveFall => {
            const initialY = model.position.y;
            const fallDuration = 1.5;
            const startTime = clock.getElapsedTime();
            function animateFall() {
                const elapsedTime = clock.getElapsedTime() - startTime;
                const fallProgress = Math.min(1, elapsedTime / fallDuration);
                if (fallProgress < 1) {
                    model.position.y = initialY - fallProgress * (initialY + model.scale.y * 1.5);
                    model.rotation.z = Math.sin(fallProgress * Math.PI * 0.5) * (Math.PI / 2);
                    requestAnimationFrame(animateFall);
                } else {
                    model.position.y = initialY - (initialY + model.scale.y * 1.5);
                    model.rotation.z = Math.PI / 2;
                    resolveFall();
                }
            }
            animateFall();
        });

        await new Promise(r => setTimeout(r, 300));
        
        model.visible = false; 
        await triggerLightBeamEffect(model.position, true);
        return Promise.resolve();
    },

    announceTurn: (message) => {
        const logContainer = document.getElementById('battle-log-container'); 
        const logContent = document.getElementById('battle-log');

        if (logContainer && logContent) {
            const p = document.createElement('p');
            p.textContent = message;
            logContent.appendChild(p); 

            logContainer.scrollTop = logContainer.scrollHeight; 
        }
    },

    announceWinner: (winnerName) => {
        backgroundMusic.pause();
        backgroundMusic.currentTime = 0;

        const winnerMessageEl = document.getElementById('winner-message');
        if (winnerMessageEl) {
            setTimeout(() => {
                winnerMessageEl.textContent = `${winnerName} wins the battle!`;
                winnerMessageEl.style.display = 'block';
            }, 2000);
        }
    },

    enableMoveSelection: (pokemonName, enable) => {
        const menu = document.getElementById(`${pokemonName}-menu`);

        if (menu) {
            menu.querySelectorAll('.move-button').forEach(button => button.disabled = !enable);
        }
    },

    setWeatherEffect: async (newWeather, oldWeather = "clear") => {
        const duration = 1.0; 
        const currentTime = clock.getElapsedTime();
        const { ambientLight, directionalLight } = scene.userData;

        const initialDirLightIntensity = directionalLight.intensity;
        const initialAmbLightIntensity = ambientLight.intensity;
        const initialAmbLightColor = ambientLight.color.clone();
        const initialDirLightColor = directionalLight.color.clone();
        let targetDirLightIntensity, targetAmbLightIntensity;
        let targetAmbLightColor = new THREE.Color(), targetDirLightColor = new THREE.Color();
        
        if (rainParticles) {
            rainParticles.visible = (newWeather === 'rain');
        }
        if (sunbeamGroup) {
            sunbeamGroup.visible = (newWeather === 'sun');
        }

        if (newWeather !== 'sun') {
            currentSunnyDayPulse = false; 
        }

        if (newWeather === 'sun') {
            targetDirLightIntensity = 2.5; targetAmbLightIntensity = 1.25; 
            targetAmbLightColor.set(0xFFFFFF); targetDirLightColor.set(0xFFFFEE); 
        } else if (newWeather === 'rain') {
            targetDirLightIntensity = 0.6; targetAmbLightIntensity = 0.5; 
            targetAmbLightColor.set(0xADBED5); targetDirLightColor.set(0xAEBBD0); 
        } else {
            targetDirLightIntensity = 0.9; targetAmbLightIntensity = 0.7; 
            targetAmbLightColor.set(0xFFFFFF); targetDirLightColor.set(0xFFFFFF);
        }
        
        baseDirLightIntensity = targetDirLightIntensity;
        baseAmbLightIntensity = targetAmbLightIntensity;

        function animateWeatherChange() {
            const t = Math.min(1, (clock.getElapsedTime() - currentTime) / duration);
            directionalLight.intensity = THREE.MathUtils.lerp(initialDirLightIntensity, targetDirLightIntensity, t);
            ambientLight.intensity = THREE.MathUtils.lerp(initialAmbLightIntensity, targetAmbLightIntensity, t);
            ambientLight.color.lerpColors(initialAmbLightColor, targetAmbLightColor, t);
            directionalLight.color.lerpColors(initialDirLightColor, targetDirLightColor, t);

            if (t < 1) {
                requestAnimationFrame(animateWeatherChange);
            }
        }
        animateWeatherChange();
        return Promise.resolve();
    },
    
    triggerSunnyDayTurnEffect: async () => {
        if (currentSunnyDayPulse) return;
        currentSunnyDayPulse = true;

        const pulseDuration = 0.75; 
        const totalEffectDuration = 2.0;
        const pulseStartTime = clock.getElapsedTime();
        const { ambientLight, directionalLight } = scene.userData;       
        const actualCurrentDirIntensity = directionalLight.intensity; 
        const actualCurrentAmbIntensity = ambientLight.intensity;

        const pulseDirIntensityTarget = baseDirLightIntensity * 1.4; 
        const pulseAmbIntensityTarget = baseAmbLightIntensity * 1.3;

        function animateSunPulse() {
            const elapsedTime = clock.getElapsedTime() - pulseStartTime;
            if (elapsedTime < totalEffectDuration) {
                let t_pulse;
                if (elapsedTime < pulseDuration) { 
                    t_pulse = elapsedTime / pulseDuration;
                    directionalLight.intensity = THREE.MathUtils.lerp(actualCurrentDirIntensity, pulseDirIntensityTarget, t_pulse);
                    ambientLight.intensity = THREE.MathUtils.lerp(actualCurrentAmbIntensity, pulseAmbIntensityTarget, t_pulse);
                } else { 
                    t_pulse = (elapsedTime - pulseDuration) / (totalEffectDuration - pulseDuration);
                    directionalLight.intensity = THREE.MathUtils.lerp(pulseDirIntensityTarget, baseDirLightIntensity, t_pulse);
                    ambientLight.intensity = THREE.MathUtils.lerp(pulseAmbIntensityTarget, baseAmbLightIntensity, t_pulse);
                }
                requestAnimationFrame(animateSunPulse);
            } else {
                directionalLight.intensity = baseDirLightIntensity; 
                ambientLight.intensity = baseAmbLightIntensity;
                currentSunnyDayPulse = false;
            }
        }
        animateSunPulse();
        return Promise.resolve();
    },

    triggerRainTurnEffect: async () => {
        sceneTriggerRainEffect();
        return Promise.resolve();
    }
};

function createPokemonMenu(pokemonKey) {
    const pokemon = statsPokemon[pokemonKey];
    const menuContainer = document.getElementById(`${pokemonKey}-menu`);
    if (!pokemon || !menuContainer) return;

    menuContainer.innerHTML = `
        <h3>${pokemon.nome}</h3>
        <div class="pokemon-info">
            <p>Attack: ${pokemon.attack}</p>
            <p>Defence: ${pokemon.defence}</p>
            <p>Speed: ${pokemon.speed}</p>
        </div>
        <div class="moves-list">
            <h4>Mosse</h4>
            ${pokemon.mosse.map(moveKey =>
                `<button class="move-button" data-move="${moveKey}">${movesData[moveKey]?.name || moveKey}</button>`
            ).join('')}
        </div>
        <button class="close-button">Chiudi</button>
    `;
}

async function startGame(chosenPokemon) {
    playerPokemonName = chosenPokemon;
    const opponentPokemonName = chosenPokemon === 'magnemite' ? 'jigglypuff' : 'magnemite';

    document.getElementById('selection-screen').style.display = 'none';

    await spawnPokemonAnimation(playerPokemonName);
    await new Promise(r => setTimeout(r, 200));
    await spawnPokemonAnimation(opponentPokemonName);

    backgroundMusic.play().catch(error => {
        console.error("Sound play error:", error);
    });
    document.getElementById('health-bars-container').style.display = 'flex';
    document.getElementById('battle-log-container').style.display = 'block';
    mainInterfaceFunctions.updateHPUI('magnemite', statsPokemon.magnemite.hp);
    mainInterfaceFunctions.updateHPUI('jigglypuff', statsPokemon.jigglypuff.hp);
    
    initAnimations(scene, clock, camera, pokemonModels);
    
    initGameLogic(statsPokemon, mainInterfaceFunctions, chosenPokemon);
}

document.querySelectorAll('.pokemon-choice-button').forEach(button => {
    button.addEventListener('click', (e) => {
        document.getElementById('selection-screen').style.pointerEvents = 'none';
        startGame(e.target.dataset.pokemon);
    });
});

window.addEventListener('click', (event) => {
    if (backgroundMusic.paused && backgroundMusic.currentTime === 0) {
        backgroundMusic.play().catch(e => {});
    }


    if (event.target.closest('.pokemon-menu, #battle-log-container, #winner-message')) return;
    
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    const intersects = raycaster.intersectObjects(scene.children, true);
    let clickedPokemonKey = null;
    for (const intersect of intersects) {
        let parent = intersect.object;
        while (parent) {
            if (parent === pokemonModels.magnemite) { clickedPokemonKey = 'magnemite'; break; }
            if (parent === pokemonModels.jigglypuff) { clickedPokemonKey = 'jigglypuff'; break; }
            parent = parent.parent;
        }
        if (clickedPokemonKey) break;
    }

    if (clickedPokemonKey) {
        if (clickedPokemonKey !== playerPokemonName) {
            console.log("you clicked on the enemy pokemon. You can't see his moves.");
            return;
        }
        const menuToToggle = document.getElementById(`${clickedPokemonKey}-menu`);
        if (menuToToggle) {
            document.querySelectorAll('.pokemon-menu').forEach(menu => menu.style.display = 'none');
            menuToToggle.style.display = 'block';
        }
    }
});

document.body.addEventListener('click', function(e) {
    if (e.target.classList.contains('close-button')) {
        e.stopPropagation();
        e.target.closest('.pokemon-menu').style.display = 'none';
    }
    
    if (e.target.classList.contains('move-button')) {
        e.stopPropagation();
        const menu = e.target.closest('.pokemon-menu');
        const pokemonKey = menu.id.replace('-menu', '');
        playerSelectMove(pokemonKey, e.target.dataset.move);
        menu.style.display = 'none';
    }
});

function onModelsLoaded() {
    createPokemonMenu('magnemite');
    createPokemonMenu('jigglypuff');
    document.getElementById('selection-screen').style.display = 'flex';
}

setupScene(onModelsLoaded);

animate();