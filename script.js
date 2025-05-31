document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const screens = {
        arcade: document.getElementById('arcade-screen'),
        gamePlay: document.getElementById('game-play-screen'),
        adSimulation: document.getElementById('ad-simulation-screen'),
        revivePrompt: document.getElementById('revive-prompt-screen'),
        profile: document.getElementById('profile-screen'),
    };

    const gameListContainer = document.getElementById('game-list');
    const profileButton = document.getElementById('profile-button');
    const backToArcadeButton = document.getElementById('back-to-arcade-button');
    const totalProfileScoreDisplay = document.getElementById('total-profile-score');

    // Game Play Screen Elements
    const gameTitleDisplay = document.getElementById('game-title-display');
    const currentScoreDisplay = document.getElementById('current-score');
    const oversLeftDisplay = document.getElementById('overs-left');
    const revivesUsedThisOverDisplay = document.getElementById('revives-used-this-over');
    const roundTimeLeftDisplay = document.getElementById('round-time-left');
    const gameInstructionsDisplay = document.getElementById('game-instructions');
    const gameActionButton = document.getElementById('game-action-button');
    const simulateLoseButton = document.getElementById('simulate-lose-button');
    const quitGameButton = document.getElementById('quit-game-button');
    const gameMessageDisplay = document.getElementById('game-message');


    // Revive Prompt Elements
    const watchAdReviveButton = document.getElementById('watch-ad-revive-button');
    const skipReviveButton = document.getElementById('skip-revive-button');
    const revivePromptCountDisplay = document.getElementById('revive-prompt-count');

    // --- Game Configurations ---
    const GAME_CONFIGS = {
        'flappy-bird': { name: "Flappy Bird - Blazing Skies", instructions: "Click 'Perform Action' to Flap and score points! Each flap is +10 pts." },
        'cosmic-collector': { name: "Cosmic Collector", instructions: "Click 'Perform Action' to Collect Orbs! Each collect is +20 pts." },
        'blast-flight': { name: "Blast Flight", instructions: "Click 'Perform Action' to Blast Enemies! Each blast is +15 pts." }
    };
    const MAX_ROUNDS_PER_DAY = 6;
    const MAX_OVERS_PER_ROUND = 3;
    const MAX_REVIVES_PER_OVER = 2;
    const ROUND_DURATION_SECONDS = 3 * 60; // 3 minutes

    // --- Game State ---
    let currentScreen = 'arcade';
    let currentGameId = null;
    let currentRoundScore = 0;
    let oversLeftInRound = 0;
    let revivesUsedThisOver = 0;
    let roundTimerId = null;
    let timeLeftInRound = ROUND_DURATION_SECONDS;
    let playerProfile = {
        totalScore: 0,
        dailyPlays: {} // { "YYYY-MM-DD": { "game-id": count } }
    };

    // --- Initialization ---
    function init() {
        loadProfile();
        resetDailyPlaysIfNeeded();
        updateArcadeUI();
        showScreen('arcade');
        setupEventListeners();
    }

    function setupEventListeners() {
        profileButton.addEventListener('click', () => showScreen('profile'));
        backToArcadeButton.addEventListener('click', () => showScreen('arcade'));

        gameListContainer.addEventListener('click', (event) => {
            if (event.target.classList.contains('play-button')) {
                const gameItem = event.target.closest('.game-item');
                const gameId = gameItem.dataset.gameId;
                attemptStartGame(gameId);
            }
        });

        gameActionButton.addEventListener('click', handleGameAction);
        simulateLoseButton.addEventListener('click', () => loseOver("Simulated Loss"));
        quitGameButton.addEventListener('click', () => endRound("quit"));


        watchAdReviveButton.addEventListener('click', handleRevive);
        skipReviveButton.addEventListener('click', handleSkipRevive);
    }

    // --- Navigation ---
    function showScreen(screenId) {
        for (const key in screens) {
            screens[key].classList.remove('active');
            if (screens[key].classList.contains('modal')) { // ensure modals also hide properly
                screens[key].style.display = 'none';
            }
        }
        if (screens[screenId].classList.contains('modal')) {
            screens[screenId].style.display = 'flex'; // modals use flex for centering
        }
        screens[screenId].classList.add('active');
        currentScreen = screenId;

        if (screenId === 'profile') {
            totalProfileScoreDisplay.textContent = playerProfile.totalScore;
        }
        if (screenId === 'arcade') {
            updateArcadeUI();
        }
    }

    // --- Arcade Logic ---
    function updateArcadeUI() {
        const today = getTodayDateString();
        document.querySelectorAll('.game-item').forEach(item => {
            const gameId = item.dataset.gameId;
            const roundsPlayedToday = playerProfile.dailyPlays[today]?.[gameId] || 0;
            item.querySelector('.rounds-left').textContent = MAX_ROUNDS_PER_DAY - roundsPlayedToday;
            const playButton = item.querySelector('.play-button');
            if (roundsPlayedToday >= MAX_ROUNDS_PER_DAY) {
                playButton.disabled = true;
                playButton.textContent = "No Rounds Left";
            } else {
                playButton.disabled = false;
                playButton.textContent = "Play";
            }
        });
    }

    function attemptStartGame(gameId) {
        const today = getTodayDateString();
        const roundsPlayedToday = playerProfile.dailyPlays[today]?.[gameId] || 0;

        if (roundsPlayedToday >= MAX_ROUNDS_PER_DAY) {
            alert("You've played all your rounds for this game today!");
            return;
        }

        currentGameId = gameId;
        showAd(() => { // Callback after ad finishes
            startGame();
        });
    }

    // --- Ad Simulation ---
    function showAd(callback) {
        showScreen('adSimulation');
        // Simulate ad duration
        setTimeout(() => {
            if (callback) callback();
        }, 2000); // Simulate 2 second ad
    }

    // --- Game Flow ---
    function startGame() {
        currentRoundScore = 0;
        oversLeftInRound = MAX_OVERS_PER_ROUND;
        gameTitleDisplay.textContent = GAME_CONFIGS[currentGameId].name;
        gameInstructionsDisplay.textContent = GAME_CONFIGS[currentGameId].instructions;
        gameMessageDisplay.textContent = "";
        startNewOver();
        startRoundTimer();
        updateGameStatsUI();
        showScreen('gamePlay');
    }

    function startNewOver() {
        revivesUsedThisOver = 0;
        // Reset any per-over game state here (e.g., player position in a real game)
        updateGameStatsUI();
        gameMessageDisplay.textContent = `Starting Over ${MAX_OVERS_PER_ROUND - oversLeftInRound + 1}!`;
        // Enable game action button if it was disabled
        gameActionButton.disabled = false;
        simulateLoseButton.disabled = false;
    }

    function handleGameAction() {
        // SIMULATED GAMEPLAY: Increment score based on game
        let pointsEarned = 0;
        if (currentGameId === 'flappy-bird') pointsEarned = 10;
        else if (currentGameId === 'cosmic-collector') pointsEarned = 20;
        else if (currentGameId === 'blast-flight') pointsEarned = 15;
        
        currentRoundScore += pointsEarned;
        gameMessageDisplay.textContent = `+${pointsEarned} points!`;
        updateGameStatsUI();

        // In a real game, you'd check for win/lose conditions here constantly
    }

    function loseOver(reason) {
        gameActionButton.disabled = true; // Disable actions while deciding on revive
        simulateLoseButton.disabled = true;
        gameMessageDisplay.textContent = `Over Lost: ${reason}!`;
        console.log("Over lost. Revives used this over:", revivesUsedThisOver);
        if (revivesUsedThisOver < MAX_REVIVES_PER_OVER) {
            promptRevive();
        } else {
            endOver();
        }
    }

    function promptRevive() {
        revivePromptCountDisplay.textContent = MAX_REVIVES_PER_OVER - revivesUsedThisOver;
        showScreen('revivePrompt');
    }

    function handleRevive() {
        showAd(() => {
            revivesUsedThisOver++;
            gameMessageDisplay.textContent = "Revived!";
            // In a real game: Reset player to a safe state, continue the over
            gameActionButton.disabled = false;
            simulateLoseButton.disabled = false;
            updateGameStatsUI();
            showScreen('gamePlay');
        });
    }

    function handleSkipRevive() {
        endOver();
    }

    function endOver() {
        oversLeftInRound--;
        updateGameStatsUI();
        if (oversLeftInRound <= 0) {
            endRound("overs_used");
        } else {
            // Start the next over
            startNewOver();
            showScreen('gamePlay'); // Ensure we are back on game screen if revive prompt was shown
        }
    }

    function endRound(reason) {
        stopRoundTimer();
        playerProfile.totalScore += currentRoundScore;

        const today = getTodayDateString();
        if (!playerProfile.dailyPlays[today]) {
            playerProfile.dailyPlays[today] = {};
        }
        if (!playerProfile.dailyPlays[today][currentGameId]) {
            playerProfile.dailyPlays[today][currentGameId] = 0;
        }
        playerProfile.dailyPlays[today][currentGameId]++;

        saveProfile();

        let endMessage = `Round Over! Score: ${currentRoundScore}. `;
        if (reason === "overs_used") endMessage += "All overs used.";
        if (reason === "time_up") endMessage += "Time ran out.";
        if (reason === "quit") endMessage += "Round quit.";
        
        alert(endMessage + `\nTotal Profile Score: ${playerProfile.totalScore}`);
        
        currentGameId = null;
        currentRoundScore = 0;
        updateArcadeUI();
        showScreen('arcade');
    }

    function updateGameStatsUI() {
        currentScoreDisplay.textContent = currentRoundScore;
        oversLeftDisplay.textContent = oversLeftInRound;
        revivesUsedThisOverDisplay.textContent = `${revivesUsedThisOver}/${MAX_REVIVES_PER_OVER}`;
        
        const minutes = Math.floor(timeLeftInRound / 60);
        const seconds = timeLeftInRound % 60;
        roundTimeLeftDisplay.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    // --- Timers ---
    function startRoundTimer() {
        timeLeftInRound = ROUND_DURATION_SECONDS;
        updateGameStatsUI(); // Initial display
        if (roundTimerId) clearInterval(roundTimerId); // Clear existing timer

        roundTimerId = setInterval(() => {
            timeLeftInRound--;
            updateGameStatsUI();
            if (timeLeftInRound <= 0) {
                endRound("time_up");
            }
        }, 1000);
    }

    function stopRoundTimer() {
        clearInterval(roundTimerId);
        roundTimerId = null;
    }

    // --- Profile & Data ---
    function loadProfile() {
        const storedProfile = localStorage.getItem('miniGameArcadeProfile');
        if (storedProfile) {
            playerProfile = JSON.parse(storedProfile);
        }
    }

    function saveProfile() {
        localStorage.setItem('miniGameArcadeProfile', JSON.stringify(playerProfile));
    }

    function getTodayDateString() {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
        const day = String(today.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function resetDailyPlaysIfNeeded() {
        const today = getTodayDateString();
        if (!playerProfile.dailyPlays[today]) {
            // It's a new day or first time playing
            playerProfile.dailyPlays = {}; // Clear out old dates
            playerProfile.dailyPlays[today] = {}; // Initialize today's plays
            Object.keys(GAME_CONFIGS).forEach(gameId => {
                playerProfile.dailyPlays[today][gameId] = 0;
            });
            saveProfile();
            console.log("Daily plays reset for new day:", today);
        }
    }

    // --- Start the app ---
    init();
});