const formatTime = (totalMinutes) => {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours > 0) {
        return `${hours}h ${minutes}m`;
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

function updateSelectedTime() {
    const selectedTimeSpan = document.getElementById('selected-time');
    const timeRangeInput = document.getElementById('time-range');
    if (selectedTimeSpan && timeRangeInput) {
        selectedTimeSpan.textContent = `${timeRangeInput.value}m`;
    }
}

function updateRangeMax(remainingTime) {
    const timeRangeInput = document.getElementById('time-range');
    if (timeRangeInput) {
        const roundedMax = Math.ceil(remainingTime / 30) * 30;
        timeRangeInput.max = roundedMax;
        if (parseInt(timeRangeInput.value) > roundedMax) {
            timeRangeInput.value = roundedMax;
            updateSelectedTime();
        }
    }
}

const updateWatchableLessonsDisplay = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, { action: "getSectionData" }, (response) => {
            if (response) {
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
                function calculateWatchableLessons(maxMinutes) {
                    let totalMinutes = 0;

                    // const watchableLessons = [];
                    // for (const lesson of lessons) {
                    //     const lessonMinutes = convertTimeToMinutes(lesson.time);
                    //     if (totalMinutes + lessonMinutes <= maxMinutes) {
                    //         watchableLessons.push(lesson.title);
                    //         totalMinutes += lessonMinutes;
                    //     } else {
                    //         break;
                    //     }
                    // }

                    // return watchableLessons;

                    let lastWatchableLesson = null;

                    for (const lesson of lessons) {
                        const lessonMinutes = convertTimeToMinutes(lesson.time);
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
                document.getElementById('time-remaining').textContent = formatTime(remainingTime);
                document.getElementById('last-lesson').textContent = `${lastWatchableLesson}`;

                updateRangeMax(remainingTime);
            } else {
                document.getElementById('section-name').textContent = 'Erro ao obter dados';
                document.getElementById('time-remaining').textContent = '0m';
                document.getElementById('last-lesson').textContent = 'Nenhuma';
            }
        });
    });
};

document.addEventListener('DOMContentLoaded', () => {
    updateSelectedTimeDisplay();
    updateWatchableLessonsDisplay();

    document.getElementById('time-range').addEventListener('input', () => {
        updateSelectedTimeDisplay();
        updateWatchableLessonsDisplay();
    });
});