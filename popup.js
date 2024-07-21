const formatTime = (totalMinutes) => {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours > 0) {
        if (minutes > 0) {
            return `${hours}h${minutes}`;
        }
        return `${hours}h`;
    }
    return `${minutes}m`;
};

const getSelectedTime = () => {
    const timeRange = document.getElementById('time-range').value;
    return parseInt(timeRange, 10);
};

const updateSelectedTimeDisplay = () => {
    const selectedTime = getSelectedTime();
    document.getElementById('selected-time').textContent = formatTime(selectedTime);
};

function updateRangeMax(remainingTime) {
    const timeRangeInput = document.getElementById('time-range');

    if (timeRangeInput) {
        const roundedMax = Math.ceil(remainingTime / 30) * 30;
        timeRangeInput.max = roundedMax;
        if (parseInt(timeRangeInput.value) > roundedMax) {
            timeRangeInput.value = roundedMax;
        }
        updateSelectedTimeDisplay();
    }
}

function convertTimeToMinutes(timeString) {
    const timeParts = timeString.split(' ');
    let minutes = 0;
    timeParts.forEach(part => {
        if (part.endsWith('h')) {
            minutes += parseInt(part) * 60;
        } else if (part.endsWith('m')) {
            minutes += parseInt(part);
        }
    });
    return minutes;
}

const updateWatchableLessonsDisplay = (speed = 1) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, { action: "getSectionData" }, (response) => {

            if (response) {
                function calculateWatchableLessons(maxMinutes) {
                    let totalMinutes = 0;
                    let lastWatchableLesson = null;

                    for (const lesson of lessons) {
                        const lessonMinutes = Math.round(convertTimeToMinutes(lesson.time) / speed);
                        if (totalMinutes + lessonMinutes <= maxMinutes) {
                            lastWatchableLesson = lesson.title;
                            totalMinutes += lessonMinutes;
                        } else {
                            break;
                        }
                    }

                    return lastWatchableLesson;
                }

                const sectionTitle = response.sectionTitle || 'Não disponível';
                const remainingTime = response.remainingTime || 0;
                const lessons = response.lessons || [];
                const maxWatchTime = getSelectedTime();
                const lastWatchableLesson = calculateWatchableLessons(maxWatchTime);

                document.getElementById('section-name').textContent = sectionTitle;
                document.getElementById('time-remaining').textContent = formatTime(Math.round(remainingTime / speed));
                document.getElementById('last-lesson').textContent = `${lastWatchableLesson}`;

                updateRangeMax(Math.round(remainingTime / speed));
            } else {
                document.getElementById('section-name').textContent = 'Erro ao obter dados';
                document.getElementById('time-remaining').textContent = '0m';
                document.getElementById('last-lesson').textContent = 'Nenhuma';
            }
        });
    });
};

document.addEventListener('DOMContentLoaded', () => {
    const getSpeed = () => parseFloat(document.getElementById('speed-select').value) || 1;

    const updateDisplays = () => {
        const speed = getSpeed();
        updateSelectedTimeDisplay();
        updateWatchableLessonsDisplay(speed);
    };

    updateDisplays();

    document.getElementById('time-range').addEventListener('input', updateDisplays);
    document.getElementById('speed-select').addEventListener('change', updateDisplays);
    document.getElementById('last-lesson').addEventListener('click', () => {
        const lastLessonValue = document.getElementById('last-lesson').textContent.trim();
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            chrome.tabs.sendMessage(tabs[0].id, { action: 'highlightLesson', lesson: lastLessonValue });
        });
    });
});