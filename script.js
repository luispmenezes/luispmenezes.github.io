let legCount = 0;
const legsModel = [];
const transitionsModel = [];

document.getElementById('sportForm').addEventListener('submit', function (event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const legs = [];

    for (const [key, value] of formData.entries()) {
        if (key.startsWith('leg')) {
            const [_, legType, legId, field] = key.split('-');
            let leg = legs.find(l => l.id === legId && l.type === legType);
            if (!leg) {
                leg = { id: legId, type: legType };
                legs.push(leg);
            }
            leg[field] = value;
        }
    }

    const results = calculateMultiSportTime(legs);
    displayResults(results);
});

function addLeg(type) {
    const legId = ++legCount;

    // Add a transition if this is not the first leg
    if (legCount > 1) {
        addTransition();
    }

    // Add the leg container
    const container = document.createElement('div');
    container.className = 'input-group';
    container.innerHTML = `
        <label>${getEmoji(type)} ${capitalize(type)}:</label>
        <input type="text" name="leg-${type}-${legId}-distance" value="0"
         placeholder="${type === 'swim' ? 'Distance in meters' : 'Distance in kilometers'}" required>
        <input type="text" name="leg-${type}-${legId}-pace" value="${type === 'bike' ? '0' : '0:00'}"
         placeholder="${type === 'swim' ? 'Pace (min:sec/100m)' : type === 'run' ? 'Pace (min:sec/km)' : 'Speed (km/h)'}" required>
        <button type="button" class="remove-btn" onclick="removeLeg('${legId}')">❌</button>
    `;
    const containerElement = document.getElementById('legsContainer');
    containerElement.appendChild(container);

    // Track the leg in the model
    legsModel.push({ id: legId, type });

    enableButtons();
}

function addTransition() {
    const transitionId = legCount;

    const transitionContainer = document.createElement('div');
    transitionContainer.className = 'input-group transition';
    transitionContainer.innerHTML = `
        <label>⏱ Transition:</label>
        <input type="text" name="leg-transition-${transitionId}-time" value="0:00" placeholder="Time (min:sec)" required>
    `;

    document.getElementById('legsContainer').appendChild(transitionContainer);

    // Track the transition in the model
    transitionsModel.push(0); // Placeholder value, will be updated later
}

function removeLeg(legId) {
    // Remove the leg container
    const legSelector = `input[name^='leg'][name$='-${legId}-distance']`;
    const legContainer = document.querySelector(legSelector)?.parentElement;
    if (!legContainer) {
        return; // If the leg doesn't exist, do nothing
    }
    legContainer.remove();

    // Remove the associated transition
    removeTransitionsAfterLeg(legId);

    // Remove the leg from the model
    const index = legsModel.findIndex(l => l.id === legId);
    if (index !== -1) {
        legsModel.splice(index, 1);
    }

    // Adjust the count
    legCount--;
    disableButtons();
}

function removeTransitionsAfterLeg(legId) {
    // Determine the index of the leg in the model
    const legIndex = legsModel.findIndex(l => l.id === legId);

    // Remove transitions that follow the removed leg
    transitionsModel.splice(legIndex, transitionsModel.length - legIndex).forEach((_, index) => {
        const transitionSelector = `input[name^='leg-transition-${legCount - index}-time']`;
        const transitionContainer = document.querySelector(transitionSelector)?.parentElement;
        if (transitionContainer) {
            transitionContainer.remove();
        }
    });
}

function resetForm() {
    document.getElementById('legsContainer').innerHTML = '';
    document.getElementById('results').innerHTML = '';
    legCount = 0;
    legsModel.length = 0;
    transitionsModel.length = 0;
    disableButtons();
}

function enableButtons() {
    document.getElementById('calculateButton').disabled = false;
    document.getElementById('resetButton').disabled = false;
}

function disableButtons() {
    const legs = document.querySelectorAll('#legsContainer .input-group');
    document.getElementById('calculateButton').disabled = legs.length === 0;
    document.getElementById('resetButton').disabled = legs.length === 0;
}

function calculateMultiSportTime(legs) {
    const results = { legs: [], totalTime: 0 };

    let totalTime = 0;
    let transitionIndex = 0;

    legs.forEach((leg, index) => {
        let timeInSeconds = 0;
        let pace = 0;

        if (leg.type === 'swim') {
            const [min, sec] = leg.pace.split(':').map(Number);
            pace = min * 60 + sec; // Pace in seconds per 100m
            timeInSeconds = (leg.distance / 100) * pace; // Convert pace to seconds per distance
        } else if (leg.type === 'run') {
            const [min, sec] = leg.pace.split(':').map(Number);
            pace = min * 60 + sec; // Pace in seconds per km
            timeInSeconds = leg.distance * pace; // Convert pace to seconds per distance
        } else if (leg.type === 'bike') {
            if (leg.pace !== '0') {
                pace = 3600 / leg.pace; // Pace in seconds per km
                if (leg.distance !== '0'){
                    timeInSeconds = leg.distance * pace;
                }
            }
        } else if (leg.type === 'transition') {
            const [minutes, seconds] = leg.time.split(':').map(Number);
            timeInSeconds = (minutes * 60) + seconds;
        }

        // Add the leg time to the total
        totalTime += timeInSeconds;
        results.legs.push({ type: leg.type, time: timeInSeconds, pace });

        // Add transition time if it's not the last leg
        if (index < legs.length - 1 && transitionIndex < transitionsModel.length) {
            const transitionTime = transitionsModel[transitionIndex];
            totalTime += transitionTime;
            transitionIndex++;
        }
    });

    results.totalTime = totalTime;

    return results;
}

function displayResults(results) {
    let legCount = { swim: 0, run: 0, bike: 0, transition: 0 };
    const legNames = results.legs.map(leg => {
        if (leg.type !== 'transition') {
            legCount[leg.type]++;
            return `${capitalize(leg.type)} ${legCount[leg.type]}`;
        } else {
            legCount[leg.type]++;
            return `T${legCount[leg.type]}`;
        }
    });

    const tableRows = results.legs.map((leg, index) => {
        const time = convertSecondsToHMS(leg.time);
        const pace = leg.type === 'transition' ? '' : formatPace(leg.pace, leg.type); // Empty string for transition pace
        return `<tr><td>${legNames[index]}</td><td>${time}</td><td>${pace}</td></tr>`;
    }).join('');

    document.getElementById('results').innerHTML = `
        <table>
            <tr>
                <th>Leg</th>
                <th>Time</th>
                <th>Pace</th>
            </tr>
            ${tableRows}
            <tr class="total-time">
                <th>Total</th>
                <th colspan="2">${convertSecondsToHMS(results.totalTime)}</th>
            </tr>
        </table>
    `;
}

function convertSecondsToHMS(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const sec = Math.round(seconds % 60);
    return `${hours}:${minutes.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
}

function formatPace(pace, type) {
    if (isNaN(pace)) {
        return 'N/A'; // Handle NaN cases
    }

    if (type === 'swim') {
        const minutes = Math.floor(pace / 60);
        const seconds = Math.round(pace % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')} min/100m`;
    } else if (type === 'run') {
        const minutes = Math.floor(pace / 60);
        const seconds = Math.round(pace % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')} min/km`;
    } else if (type === 'bike') {
        if (pace === 0) {
            return `0 km/h`;
        }
        return `${(3600 / pace).toFixed(2)} km/h`;
    }
}

function capitalize(word) {
    return word.charAt(0).toUpperCase() + word.slice(1);
}

function getEmoji(type) {
    switch (type) {
        case 'swim':
            return '🏊‍♂️';
        case 'run':
            return '🏃‍♂️';
        case 'bike':
            return '🚴‍♂️';
        default:
            return '⏱';
    }
}
