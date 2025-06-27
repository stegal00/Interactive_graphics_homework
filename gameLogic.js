let mainInterface = {
    updateHPUI: (pokemonName, newHP, damageDealt) => {},
    triggerAttackAnimation: async (attackerName, moveName) => {},
    triggerDamageAnimation: async (pokemonName) => {},
    triggerDefeatAnimation: async (pokemonName) => {},
    announceTurn: (message) => {},
    announceWinner: (winnerName) => {},
    enableMoveSelection: (pokemonName, enable) => {},
    setWeatherEffect: async (weather, oldWeather) => {},
    triggerSunnyDayTurnEffect: async () => {},
    triggerRainTurnEffect: async () => {}
};

const movesData = {
    "Rapid-spin": { name: "Rapid-spin", power: 10, type: "normal", target: "opponent", effect: null, description: "pokemon ruota velocemente e colpisce avversario" },
    "Electroball": { name: "Electroball", power: 15, type: "electric", target: "opponent", effect: null, description: "spara una palla elettrica ad avversario" },
    "Cannon-flash": { name: "Cannon-flash", power: 15, type: "steel", target: "opponent", effect: null, description: "spara un fascio di luce metallica all'avversario" },
    "Raindance": { name: "Raindance", power: 0, type: "water", target: "field", effect: { type: "weather", condition: "rain" }, description: "fa cadere la pioggia" },
    "Sing": { name: "Sing", power: 0, type: "normal", target: "opponent", effect: { type: "status", status: "sleep", probability: 0.6, duration: 2 }, description: "avversario si addormenta (salta 1 azione, probabilita di riuscita 60%)" },
    "SunnyDay": { name: "SunnyDay", power: 0, type: "fire", target: "field", effect: { type: "weather", condition: "sun" }, description: "fa uscire il sole" },
    "Flamethrower": { name: "Flamethrower", power: 15, type: "fire", target: "opponent", effect: { type: "damage_modifier_weather", sunBonus: 5, rainPenalty: -5 }, description: "spara fuoco all'avversario (+5 se ce sole, -5 se ce pioggia)" },
    "Echoing-voice": { name: "Echoing-voice", power: 15, type: "normal", target: "opponent", effect: null, description: "lancia onde sonore all'avversario" }
};

let gameState = {
    pokemon: {},
    playerPokemon: null,
    opponentPokemon: null,
    selectedMoves: {
        magnemite: null,
        jigglypuff: null
    },
    currentTurn: 0,
    isProcessingTurn: false,
    battleLog: [],
    weather: "clear",
    weatherDuration: 0,
    statusConditions: {
        magnemite: { effects: [] },
        jigglypuff: { effects: [] }
    },
    isBattleOver: false
};

export function initGameLogic(initialStats, interfaceFunctions, chosenPlayerPokemon) {
    gameState.playerPokemon = chosenPlayerPokemon;
    gameState.opponentPokemon = chosenPlayerPokemon === 'magnemite' ? 'jigglypuff' : 'magnemite';
    
    console.log(`Player has been set to: ${gameState.playerPokemon}`);
    console.log(`Opponent has been set to: ${gameState.opponentPokemon}`);

    gameState.pokemon = JSON.parse(JSON.stringify(initialStats));

    mainInterface = interfaceFunctions;

    mainInterface.updateHPUI(gameState.playerPokemon, gameState.pokemon[gameState.playerPokemon].hp, 0);
    mainInterface.updateHPUI(gameState.opponentPokemon, gameState.pokemon[gameState.opponentPokemon].hp, 0);

    logToBattleLog("Battle bagins!");

    mainInterface.setWeatherEffect(gameState.weather, "clear");

    beginNewSelectionPhase();
}

function logToBattleLog(message) {
    gameState.battleLog.push(message);

    mainInterface.announceTurn(message);
    
    console.log(message);
}

async function beginNewSelectionPhase() {
    if (gameState.isBattleOver || gameState.isProcessingTurn) return;

    const player = gameState.playerPokemon;
    gameState.selectedMoves[player] = null;
    gameState.selectedMoves[gameState.opponentPokemon] = null;

    if (gameState.weatherDuration > 0) {
        if (gameState.weather === "sun") {
            logToBattleLog("The sun continues to shine brightly!");
            await mainInterface.triggerSunnyDayTurnEffect(); 
        } else if (gameState.weather === "rain") {
            logToBattleLog("The rain continues to fall.");
            await mainInterface.triggerRainTurnEffect();
        }
    }

    mainInterface.enableMoveSelection(player, true);
    
    if (!gameState.selectedMoves[gameState.opponentPokemon]) {
        selectOpponentMove();
    }
}

function disableAllSelections() {
    mainInterface.enableMoveSelection(gameState.playerPokemon, false);
}

function selectOpponentMove() {
    if (gameState.selectedMoves[gameState.opponentPokemon]) return;

    const opponentName = gameState.opponentPokemon;
    const opponentData = gameState.pokemon[opponentName];
    const possibleMoveKeys = opponentData.mosse;

    if (possibleMoveKeys && possibleMoveKeys.length > 0) {
        const randomMoveKey = possibleMoveKeys[Math.floor(Math.random() * possibleMoveKeys.length)];
        gameState.selectedMoves[opponentName] = randomMoveKey;
        logToBattleLog(`${opponentData.nome} (enemy) prepeared ${movesData[randomMoveKey].name}.`);
    } else {
        console.error(`The enemy (${opponentName}) can't select valid moves!`);
        gameState.selectedMoves[opponentName] = 'struggle';
        logToBattleLog(`${opponentData.nome} (enemy) usa struggle out of desperation!`);
    }
}

export function playerSelectMove(pokemonName, moveKey) {
    if (gameState.isProcessingTurn || gameState.isBattleOver) return;
    if (pokemonName !== gameState.playerPokemon) return;

    gameState.selectedMoves[pokemonName] = moveKey;
    logToBattleLog(`${gameState.pokemon[pokemonName].nome} selected ${movesData[moveKey].name}.`);
    
    mainInterface.enableMoveSelection(pokemonName, false);

    if (gameState.selectedMoves[gameState.opponentPokemon]) {
        gameState.isProcessingTurn = true;
        disableAllSelections();
        processTurn();
    }
}

function determineAttackOrder() {
    const p1Name = gameState.playerPokemon;
    const p2Name = gameState.opponentPokemon;
    const p1 = gameState.pokemon[p1Name];
    const p2 = gameState.pokemon[p2Name];
    const move1Key = gameState.selectedMoves[p1Name];
    const move2Key = gameState.selectedMoves[p2Name];

    if (p1.speed > p2.speed) {
        return [
            { pokemonName: p1Name, moveKey: move1Key, targetName: p2Name },
            { pokemonName: p2Name, moveKey: move2Key, targetName: p1Name }
        ];
    } else if (p2.speed > p1.speed) {
        return [
            { pokemonName: p2Name, moveKey: move2Key, targetName: p1Name },
            { pokemonName: p1Name, moveKey: move1Key, targetName: p2Name }
        ];
    } else {
        return Math.random() < 0.5 ?
            [
                { pokemonName: p1Name, moveKey: move1Key, targetName: p2Name },
                { pokemonName: p2Name, moveKey: move2Key, targetName: p1Name }
            ] :
            [
                { pokemonName: p2Name, moveKey: move2Key, targetName: p1Name },
                { pokemonName: p1Name, moveKey: move1Key, targetName: p2Name }
            ];
    }
}

function isAsleep(pokemonName) {
    const status = gameState.statusConditions[pokemonName];
    return status.effects.some(effect => effect.type === 'sleep');
}

async function processTurn() {
    gameState.currentTurn++;
    logToBattleLog(`--- Round ${gameState.currentTurn} ---`);

    const attackOrder = determineAttackOrder();

    for (const action of attackOrder) {
        if (gameState.isBattleOver) break;
        const attackerName = action.pokemonName;
        const defenderName = action.targetName;
        const moveKey = action.moveKey;
        const attackerData = gameState.pokemon[attackerName];

        if (isAsleep(attackerName)) {
            logToBattleLog(`${attackerData.nome} is asleep and cannot attack!`);
            await mainInterface.triggerAttackAnimation(attackerName, 'sleep');
            continue;
        }

        const move = movesData[moveKey];
        if (!move) {
            console.error(`move not found: ${moveKey} for ${attackerName}`);
            logToBattleLog(`${attackerData.nome} is confused and it does nothing.`);
            await mainInterface.triggerAttackAnimation(attackerName, 'default_attack');
            continue;
        }

        logToBattleLog(`${attackerData.nome} usa ${move.name}!`);
        await mainInterface.triggerAttackAnimation(attackerName, moveKey);
        
        await applyMove(attackerName, defenderName, moveKey);

        if (gameState.pokemon[defenderName].hp <= 0) {
            logToBattleLog(`${gameState.pokemon[defenderName].nome} is exhausted!`);
            await mainInterface.triggerDefeatAnimation(defenderName);
            gameState.isBattleOver = true;
            const winner = attackerName;
            logToBattleLog(`${gameState.pokemon[winner].nome} wins the battle!`);
            mainInterface.announceWinner(gameState.pokemon[winner].nome);
            disableAllSelections();
            break;
        }
    }

    if (!gameState.isBattleOver) {
        handleEndOfTurnStatusEffects();
        await handleEndOfTurnWeather();
        logToBattleLog(`--- End of Round ${gameState.currentTurn} ---`);
        gameState.isProcessingTurn = false;
        beginNewSelectionPhase();
    }
}

function handleEndOfTurnStatusEffects() {
    for (const pokemonName of [gameState.playerPokemon, gameState.opponentPokemon]) {

        const status = gameState.statusConditions[pokemonName];
        if (!status.effects) status.effects = [];

        status.effects = status.effects.filter(effect => {
            if (effect.duration !== undefined) {
                effect.duration--;
                if (effect.duration <= 0) {
                    logToBattleLog(`${gameState.pokemon[pokemonName].nome} is no more affected by ${effect.type}.`);
                    return false;
                }
            }
            return true;
        });
    }
}

async function handleEndOfTurnWeather() {
    if (gameState.weatherDuration > 0) {
        gameState.weatherDuration--;

        if (gameState.weatherDuration === 0) {
            const oldWeather = gameState.weather;
            logToBattleLog(`the effect of ${oldWeather} vanished.`);
            gameState.weather = "clear";
            await mainInterface.setWeatherEffect(gameState.weather, oldWeather);
        }
    }
}

async function applyMove(attackerName, defenderName, moveKey) {
    const move = movesData[moveKey];
    if (!move) {
        console.error(`Attempting to apply a non-existent move: ${moveKey}`);
        return;
    }

    const attackerStats = gameState.pokemon[attackerName];
    const defenderStats = gameState.pokemon[defenderName];
    let damage = 0;

    if (move.effect?.type === "weather") {
        if (gameState.weather !== move.effect.condition) {
            const oldWeather = gameState.weather;
            gameState.weather = move.effect.condition;
            gameState.weatherDuration = 5;
            logToBattleLog(`The weather changed in ${gameState.weather}! will least ${gameState.weatherDuration} rounds.`);
            await mainInterface.setWeatherEffect(gameState.weather, oldWeather);

            if (gameState.weather === "sun") {
                await mainInterface.triggerSunnyDayTurnEffect();
            } else if (gameState.weather === "rain") {
                await mainInterface.triggerRainTurnEffect();
            }
        } else {
            logToBattleLog(`The weather is already ${gameState.weather}. The move has no further effect.`);
        }
    }

    if (move.power > 0) {
        damage = Math.max(1, attackerStats.attack - defenderStats.defence + move.power);
        if (moveKey === "Flamethrower") { 
            if (gameState.weather === "sun") {
                damage += 5;
                logToBattleLog("The sun powers up Flamethrower!");
            } else if (gameState.weather === "rain") {
                damage = Math.max(1, damage - 5);
                logToBattleLog("Rain weakens Flamethrower!");
            }
        }        
        defenderStats.hp = Math.max(0, defenderStats.hp - damage);
        logToBattleLog(`${gameState.pokemon[defenderName].nome} suffers ${damage} dameges.`);
        mainInterface.updateHPUI(defenderName, defenderStats.hp, damage);
        await mainInterface.triggerDamageAnimation(defenderName);
    }

    if (move.effect?.type === "status") {
        const isAlreadyAffected = gameState.statusConditions[defenderName].effects.some(e => e.type === move.effect.status);
        
        if (!isAlreadyAffected && Math.random() < move.effect.probability) {
            gameState.statusConditions[defenderName].effects.push({
                type: move.effect.status,
                duration: move.effect.duration
            });
            logToBattleLog(`${gameState.pokemon[defenderName].nome} was affected by ${move.effect.status}!`);
        } else if (isAlreadyAffected) {
            logToBattleLog(`${gameState.pokemon[defenderName].nome} is already affected by ${move.effect.status}.`);
        } else {
            logToBattleLog(`But fails! (${move.name} on ${gameState.pokemon[defenderName].nome})`);
        }
    }
}