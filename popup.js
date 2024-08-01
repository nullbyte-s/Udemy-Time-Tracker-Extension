let sectionData = [];
let currentSectionIndex = 0;

const formatTime = (totalMinutes) => {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours > 0) {
        if (minutes > 0) {
            return `${hours}h${minutes.toString().padStart(2, '0')}`;
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

function parseTime(timeString) {
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

const calculateWatchableLessons = (maxMinutes, lessons, speed) => {
    let totalMinutes = 0;
    let lastWatchableLesson = null;
    const unwatchedLessons = lessons.filter(lesson => lesson.time !== 'Assistido');
    const watchableLessons = [];

    for (const lesson of unwatchedLessons) {
        const lessonMinutes = Math.round(parseTime(lesson.time) / speed);
        if (totalMinutes + lessonMinutes <= maxMinutes) {
            watchableLessons.push(lesson.title);
            lastWatchableLesson = lesson.title;
            totalMinutes += lessonMinutes;
        } else {
            break;
        }
    }

    return {
        watchableLessons: watchableLessons,
        lastWatchableLesson: lastWatchableLesson
    };
};

const updateWatchableLessonsDisplay = (speed = 1) => {
    const sections = sectionData;

    if (sections.length > 0 && sections[currentSectionIndex]) {
        const section = sections[currentSectionIndex];
        const sectionTitle = section.sectionTitle;
        const remainingTime = section.remainingTime;
        const lessons = section.lessons;
        const watchedLessons = lessons.filter(lesson => lesson.time === 'Assistido');
        const maxWatchTime = getSelectedTime();
        const watchableLessons = calculateWatchableLessons(maxWatchTime, lessons, speed);
        const lastWatchableLesson = watchableLessons.lastWatchableLesson;
        const reviewSelect = document.getElementById("reviewSelect");

        function updateLessonsMarker() {
            const selectedValues = [];

            chrome.runtime.sendMessage({ action: 'getLessonsMarker' }, response => {
                if (response.status === 'success') {
                    let lessonsMarker = response.data;

                    for (const option of reviewSelect.options) {
                        if (option.selected) {
                            selectedValues.push(option.text);
                        }
                        option.selected = false;
                        option.classList.remove('selected');
                    }

                    if (lessonsMarker) {
                        let sectionFound = false;

                        for (const section of lessonsMarker) {
                            if (section.sessionTitle === sectionTitle) {
                                const lessonsSet = new Set(section.lessonsList);
                                selectedValues.forEach(value => lessonsSet.add(value));
                                section.lessonsList = Array.from(lessonsSet);
                                sectionFound = true;
                                break;
                            }
                        }

                        if (!sectionFound) {
                            lessonsMarker.push({
                                sessionTitle: sectionTitle,
                                lessons: selectedValues
                            });
                        }
                    } else {
                        lessonsMarker = [{
                            sessionTitle: sectionTitle,
                            lessons: selectedValues
                        }];
                    }

                    chrome.runtime.sendMessage({ action: 'updateLessonsMarker', data: lessonsMarker });
                    return lessonsMarker;
                } else {
                    console.log('Erro ao obter dados:', response.message);
                }
            });
        };

        if (lastWatchableLesson === null) {
            document.getElementById('last-lesson').textContent = "Seção finalizada";
            document.getElementById('last-lesson').style.color = '#B0C4DE';
            document.getElementById('last-lesson').style.fontStyle = 'italic';
        } else {
            document.getElementById('last-lesson').textContent = lastWatchableLesson;
        }

        document.getElementById('section-name').textContent = sectionTitle;
        document.getElementById('time-remaining').textContent = formatTime(Math.round(remainingTime / speed));

        reviewSelect.innerHTML = '';
        for (const lesson of watchedLessons) {
            const option = document.createElement("option");
            option.text = lesson.title;
            reviewSelect.appendChild(option);
        }

        document.getElementById('review-btn').addEventListener('click', () => {
            chrome.runtime.sendMessage({ action: 'updateLessonsMarker', data: updateLessonsMarker() });
        });

        document.getElementById('cancelReview-btn').addEventListener('click', () => {
            const selectedValues = [];

            chrome.runtime.sendMessage({ action: 'getLessonsMarker' }, response => {
                if (response.status === 'success') {
                    let lessonsMarker = response.data;

                    for (const option of reviewSelect.options) {
                        if (option.selected) {
                            selectedValues.push(option.text);
                        }
                        option.selected = false;
                        option.classList.remove('selected');
                    }

                    if (lessonsMarker) {
                        let sectionFound = false;

                        for (const section of lessonsMarker) {
                            if (section.sessionTitle === sectionTitle) {
                                section.lessonsList = section.lessonsList.filter(lesson => !selectedValues.includes(lesson));
                                sectionFound = true;
                                break;
                            }
                        }

                        if (sectionFound) {
                            chrome.runtime.sendMessage({ action: 'cancelLessonsMarker', data: selectedValues }, response => {
                                if (response.status === 'success') {
                                    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                                        chrome.tabs.sendMessage(tabs[0].id, { action: 'cancelBookmarkLesson', message: lessonsMarker });
                                    });
                                } else {
                                    console.log('Erro ao cancelar marcadores de lições:', response.message);
                                }
                            });
                        }
                    }
                } else {
                    console.log('Erro ao obter dados:', response.message);
                }
            });
        });

        document.getElementById('clear-btn').addEventListener('click', () => {
            const selectedValues = [];

            for (const option of reviewSelect.options) {
                selectedValues.push(option.text);
                option.selected = false;
                option.classList.remove('selected');
            }

            lessonsMarker = [{
                sessionTitle: sectionTitle,
                lessonsList: selectedValues
            }];

            for (const section of lessonsMarker) {
                section.lessonsList = section.lessonsList.filter(lesson => !selectedValues.includes(lesson));
                sectionFound = true;
                break;
            }

            chrome.runtime.sendMessage({ action: 'cancelLessonsMarker' }, response => {
                if (response.status === 'success') {
                    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                        chrome.tabs.sendMessage(tabs[0].id, { action: 'cancelBookmarkLesson', message: lessonsMarker });
                    });
                } else {
                    console.log('Erro ao remover todos os marcadores de lições:', response.message);
                }
            });
        });

        updateRangeMax(remainingTime / speed);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const getSpeed = () => parseFloat(document.getElementById('speed-select').value) || 1;

    const updateButtonStates = () => {
        document.getElementById('prev-section-btn').disabled = currentSectionIndex === sectionData.length - 1;
        document.getElementById('next-section-btn').disabled = currentSectionIndex === 0;
    };

    const updateDisplays = () => {
        const speed = getSpeed();
        updateSelectedTimeDisplay();
        updateWatchableLessonsDisplay(speed);
        updateButtonStates();
    };

    const setupEventListeners = () => {
        document.getElementById('time-range').addEventListener('input', updateDisplays);
        document.getElementById('speed-select').addEventListener('change', updateDisplays);

        document.getElementById('last-lesson').addEventListener('click', () => {
            const highlightLesson = document.getElementById('last-lesson').textContent.trim();
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                chrome.tabs.sendMessage(tabs[0].id, { action: 'highlightLesson', lesson: highlightLesson });
            });
        });

        document.getElementById('reviewSelect').addEventListener('mousedown', function (event) {
            event.preventDefault();
            const option = event.target;
            if (option.tagName === 'OPTION') {
                const scrollPosition = this.scrollTop;
                option.selected = !option.selected;
                option.classList.toggle('selected', option.selected);
                setTimeout(() => {
                    this.scrollTop = scrollPosition;
                }, 0);
            }
        });

        document.getElementById('prev-section-btn').addEventListener('click', () => {
            if (currentSectionIndex < sectionData.length - 1) {
                currentSectionIndex++;
                console.log('currentSectionIndex next: ' + currentSectionIndex);
                updateDisplays();
            }
        });

        document.getElementById('next-section-btn').addEventListener('click', () => {
            if (currentSectionIndex > 0) {
                currentSectionIndex--;
                console.log('currentSectionIndex prev: ' + currentSectionIndex);
                updateDisplays();
            }
        });
    };

    const loadDataAndInitialize = () => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            chrome.tabs.sendMessage(tabs[0].id, { action: "getSectionData" }, (response) => {
                if (response.status === 'success') {
                    sectionData = response.sectionData;
                    updateDisplays();
                } else {
                    document.getElementById('section-name').textContent = 'Erro ao obter dados';
                    document.getElementById('time-remaining').textContent = '0m';
                    document.getElementById('last-lesson').textContent = 'Nenhuma';
                    document.getElementById("reviewSelect").style.display = 'none';
                }
            });
        });
    };

    loadDataAndInitialize();
    setupEventListeners();
});