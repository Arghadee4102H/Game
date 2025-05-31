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
    const AD_DURATION_MS = 1500; // Shorter for testing

    // --- Game State ---
    let currentScreenId = null; // To track the active screen
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
        console.log("Initializing Arcade...");
        loadProfile();
        resetDailyPlaysIfNeeded();
        updateArcadeUI();
        setupEventListeners();
        showScreen('arcade'); // Start with the arcade screen
    }

    function setupEventListeners() {
        profileButton.addEventListener('click', () => showScreen('profile'));
        backToArcadeButton.addEventListener('click', () => showScreen('arcade'));

        gameListContainer.addEventListener('click', (event) => {
            const playButton = event.target.closest('.play-button');
            if (playButton && !playButton.disabled) {
                const gameItem = playButton.closest('.game-item');
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
    function showScreen(screenIdToShow) {
        console.log(`Switching to screen: ${screenIdToShow}`);
        currentScreenId = screenIdToShow;
        for (const id in screens) {
            if (screens[id]) { // Check if element exists
                const isModal = screens[id].classList.contains('modal');
                if (id === screenIdToShow) {
                    screens[id].style.display = isModal ? 'flex' : 'block';
                    screens[id].classList.add('active'); // Keep for potential CSS styling via .active
                } else {
                    screens[id].style.display = 'none';
                    screens[id].classList.remove('active');
                }
            }
        }

        if (screenIdToShow === 'profile') {
            totalProfileScoreDisplay.textContent = playerProfile.totalScore;
        }
        if (screenIdToShow === 'arcade') {
            updateArcadeUI(); // Refresh arcade UI when returning
        }
    }

    // --- Arcade Logic ---
    function updateArcadeUI() {
        const today = getTodayDateString();
        document.querySelectorAll('.game-item').forEach(item => {
            const gameId = item.dataset.gameId;
            const roundsPlayedToday = playerProfile.dailyPlays[today]?.[gameId] || 0;
            const roundsLeft = MAX_ROUNDS_PER_DAY - roundsPlayedToday;
            item.querySelector('.rounds-left').textContent = roundsLeft;

            const playButton = item.querySelector('.play-button');
            if (roundsLeft <= 0) {
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
        console.log(`Attempting to start game: ${gameId}. Showing pre-game ad.`);
        showAd(() => { // Callback after ad finishes
            console.log("Pre-game ad finished. Starting game.");
            startGame();
        });
    }

    // --- Ad Simulation ---
    function showAd(callback) {
        console.log("Showing ad simulation screen.");
        showScreen('adSimulation');
        setTimeout(() => {
            console.log("Ad simulation finished.");
            if (callback) callback();
        }, AD_DURATION_MS);
    }

    // --- Game Flow ---
    function startGame() {
        console.log(`Starting game: ${currentGameId}`);
        currentRoundScore = 0;
        oversLeftInRound = MAX_OVERS_PER_ROUND;
        gameTitleDisplay.textContent = GAME_CONFIGS[currentGameId].name;
        gameInstructionsDisplay.textContent = GAME_CONFIGS[currentGameId].instructions;
        gameMessageDisplay.textContent = ""; // Clear any previous messages
        
        startNewOver(); // This will set up the first over
        startRoundTimer();
        updateGameStatsUI(); // Initial UI update for game stats
        showScreen('gamePlay');
    }

    function startNewOver() {
        console.log(`Starting new over. Overs left: ${oversLeftInRound}`);
        revivesUsedThisOver = 0;
        // Reset any per-over game state here (e.g., player position in a real game)
        gameMessageDisplay.textContent = `Starting Over ${MAX_OVERS_PER_ROUND - oversLeftInRound + 1} of ${MAX_OVERS_PER_ROUND}!`;
        
        // Ensure game action buttons are enabled
        gameActionButton.disabled = false;
        simulateLoseButton.disabled = false;
        
        updateGameStatsUI(); // Update UI with new over stats
    }

    function handleGameAction() {
        // SIMULATED GAMEPLAY: Increment score based on game
        let pointsEarned = 0;
        if (currentGameId === 'flappy-bird') pointsEarned = 10;
        else if (currentGameId === 'cosmic-collector') pointsEarned = 20;
        else if (currentGameId === 'blast-flight') pointsEarned = 15;
        
        currentRoundScore += pointsEarned;
        gameMessageDisplay.textContent = `+${pointsEarned} points!`;
        console.log(`Game action: +${pointsEarned}. Current round score: ${currentRoundScore}`);
        updateGameStatsUI();

        // In a real game, you'd check for win/lose conditions here constantly
    }

    function loseOver(reason) {
        console.log(`Over lost: ${reason}. Revives used this over: ${revivesUsedThisOver}/${MAX_REVIVES_PER_OVER}`);
        gameActionButton.disabled = true; // Disable actions while deciding on revive
        simulateLoseButton.disabled = true;
        gameMessageDisplay.textContent = `Over Lost: ${reason}!`;
        
        if (revivesUsedThisOver < MAX_REVIVES_PER_OVER) {
            promptRevive();
        } else {
            console.log("No revives left for this over or player chose not to revive.");
            endOver();
        }
    }

    function promptRevive() {
        console.log("Prompting for revive.");
        revivePromptCountDisplay.textContent = MAX_REVIVES_PER_OVER - revivesUsedThisOver;
        showScreen('revivePrompt');
    }

    function handleRevive() {
        console.log("Player chose to watch ad for revive.");
        showAd(() => {
            revivesUsedThisOver++;
            console.log(`Revive successful. Revives used this over: ${revivesUsedThisOver}`);
            gameMessageDisplay.textContent = "Revived! Continue playing.";
            // In a real game: Reset player to a safe state, continue the over
            gameActionButton.disabled = false;
            simulateLoseButton.disabled = false;
            updateGameStatsUI();
            showScreen('gamePlay');
        });
    }

    function handleSkipRevive() {
        console.log("Player skipped revive.");
        endOver();
    }

    function endOver() {
        oversLeftInRound--;
        console.log(`Over ended. Overs remaining: ${oversLeftInRound}`);
        updateGameStatsUI();
        if (oversLeftInRound <= 0) {
            console.log("All overs used up for this round.");
            endRound("overs_used");
        } else {
            // Start the next over
            startNewOver();
            showScreen('gamePlay'); // Ensure we are back on game screen if revive prompt was shown
        }
    }

    function endRound(reason) {
        console.log(`Ending round. Reason: ${reason}. Final round score: ${currentRoundScore}`);
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
        console.log(`Plays for ${currentGameId} today: ${playerProfile.dailyPlays[today][currentGameId]}`);

        saveProfile();

        let endMessage = `Round Over! Your score for this round: ${currentRoundScore}. `;
        if (reason === "overs_used") endMessage += "All overs used.";
        if (reason === "time_up") endMessage += "Time ran out.";
        if (reason === "quit") endMessage += "Round quit by player.";
        
        alert(endMessage + `\nTotal Profile Score: ${playerProfile.totalScore}`);
        
        currentGameId = null;
        currentRoundScore = 0; // Reset for next potential game
        // Other states like oversLeftInRound, revivesUsedThisOver will be reset by startGame/startNewOver
        
        updateArcadeUI(); // Refresh arcade screen counts
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

        console.log("Round timer started.");
        roundTimerId = setInterval(() => {
            timeLeftInRound--;
            updateGameStatsUI();
            if (timeLeftInRound <= 0) {
                console.log("Round time up.");
                endRound("time_up");
            }
        }, 1000);
    }

    function stopRoundTimer() {
        if (roundTimerId) {
            clearInterval(roundTimerId);
            roundTimerId = null;
            console.log("Round timer stopped.");
        }
    }

    // --- Profile & Data ---
    function loadProfile() {
        const storedProfile = localStorage.getItem('miniGameArcadeProfile');
        if (storedProfile) {
            try {
                playerProfile = JSON.parse(storedProfile);
                console.log("Profile loaded from localStorage:", playerProfile);
            } catch (e) {
                console.error("Error parsing profile from localStorage:", e);
                // Initialize with default if parsing fails
                playerProfile = { totalScore: 0, dailyPlays: {} };
            }
        } else {
            console.log("No profile found in localStorage, using default.");
        }
        // Ensure dailyPlays object exists
        if (!playerProfile.dailyPlays) {
            playerProfile.dailyPlays = {};
        }
    }

    function saveProfile() {
        try {
            localStorage.setItem('miniGameArcadeProfile', JSON.stringify(playerProfile));
            console.log("Profile saved to localStorage:", playerProfile);
        } catch (e) {
            console.error("Error saving profile to localStorage:", e);
        }
    }

    function getTodayDateString() {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function resetDailyPlaysIfNeeded() {
        const today = getTodayDateString();
        if (!playerProfile.dailyPlays[today]) {
            console.log(`New day (${today}) or first play. Resetting daily play counts.`);
            playerProfile.dailyPlays = {}; // Clears all past daily play data
            playerProfile.dailyPlays[today] = {};
            // Initialize counts for all known games to 0 for the new day
            Object.keys(GAME_CONFIGS).forEach(gameId => {
                playerProfile.dailyPlays[today][gameId] = 0;
            });
            saveProfile(); // Save the reset structure
        } else {
            // Ensure all games configured have an entry for today, even if 0
             Object.keys(GAME_CONFIGS).forEach(gameId => {
                if (playerProfile.dailyPlays[today][gameId] === undefined) {
                    playerProfile.dailyPlays[today][gameId] = 0;
                }
            });
        }
    }

    // --- Start the app ---
    init();
});
