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

const setSectionVisibility = function (isAvailable) {
    const contentElement = document.getElementsByClassName('content')[0];
    const sectionNameElement = document.getElementById('section-name');
    const prevSectionBtn = document.getElementById('prev-section-btn');
    const nextSectionBtn = document.getElementById('next-section-btn');

    if (isAvailable) {
        contentElement.style.visibility = 'visible';
        prevSectionBtn.style.visibility = 'visible';
        nextSectionBtn.style.visibility = 'visible';
        sectionNameElement.style.position = 'relative';
        sectionNameElement.style.top = '';
        sectionNameElement.style.left = '';
        sectionNameElement.style.transform = '';
    } else {
        contentElement.style.visibility = 'hidden';
        prevSectionBtn.style.visibility = 'hidden';
        nextSectionBtn.style.visibility = 'hidden';
        sectionNameElement.textContent = 'Indisponível nesta página';
        sectionNameElement.style.position = 'absolute';
        sectionNameElement.style.top = '50%';
        sectionNameElement.style.left = '50%';
        sectionNameElement.style.transform = 'translate(-50%, -50%)';
    }
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

function sendMessageToContentScript(message, callback) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        try {
            chrome.tabs.sendMessage(tabs[0].id, message, response => {
                if (chrome.runtime.lastError) {
                    setSectionVisibility(false);
                } else {
                    if (callback) {
                        callback(response);
                    }
                }
            });
        } catch (error) {
            console.error('Erro ao enviar mensagem para o content script:', error);
            alert('Não foi possível enviar mensagem para o script de conteúdo.');
        }
    });
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

const setSessionVariable = (key, value) => {
    const data = {};
    data[key] = value;
    chrome.storage.local.set(data);
};

const getSessionVariable = (key, callback) => {
    chrome.storage.local.get(key, (result) => {
        callback(result[key]);
    });
};

const removeSessionVariable = (key) => {
    chrome.storage.local.remove(key);
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
                                const lessonsSet = new Set(section.lessons);
                                selectedValues.forEach(value => lessonsSet.add(value));
                                section.lessons = Array.from(lessonsSet);
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
            document.getElementById('last-lesson').parentElement.style.display = 'none';
        } else {
            document.getElementById('last-lesson').textContent = lastWatchableLesson;
        }

        const sectionNameElement = document.getElementById('section-name');
        sectionNameElement.textContent = sectionTitle;

        if (section.isExpanded === false) {
            sectionNameElement.style.cursor = 'pointer';
            sectionNameElement.style.color = 'blue';
            sectionNameElement.style.textDecoration = 'underline blue';
            sectionNameElement.onclick = () => {
                sendMessageToContentScript({ action: 'expandSection', sectionTitle: sectionTitle }, response => {
                    if (response.status === 'success') {
                        setSessionVariable('currentSectionIndex', currentSectionIndex);
                        window.location.reload();
                    }
                });
            };
        }

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
                                section.lessons = section.lessons.filter(lesson => !selectedValues.includes(lesson));
                                sectionFound = true;
                                break;
                            }
                        }

                        if (sectionFound) {

                            chrome.runtime.sendMessage({ action: 'cancelLessonsMarker', data: selectedValues }, response => {
                                if (response.status === 'success') {
                                    sendMessageToContentScript({ action: 'cancelBookmarkLesson', message: lessonsMarker });
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
                lessons: selectedValues
            }];

            for (const section of lessonsMarker) {
                section.lessons = section.lessons.filter(lesson => !selectedValues.includes(lesson));
                sectionFound = true;
                break;
            }

            chrome.runtime.sendMessage({ action: 'cancelLessonsMarker' }, response => {
                if (response.status === 'success') {
                    sendMessageToContentScript({ action: 'cancelBookmarkLesson', message: lessonsMarker });
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
    const resetLastLessonDisplay = document.getElementById('last-lesson').parentElement;
    const sectionNameElement = document.getElementById('section-name');

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
            sendMessageToContentScript({ action: 'highlightLesson', lesson: highlightLesson });
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
                resetLastLessonDisplay.style.display && resetLastLessonDisplay.style.removeProperty('display');
                sectionNameElement.style.color && (
                    sectionNameElement.style.removeProperty('color'),
                    sectionNameElement.style.removeProperty('text-decoration'),
                    sectionNameElement.style.removeProperty('cursor')
                );
                updateDisplays();
            }
        });

        document.getElementById('next-section-btn').addEventListener('click', () => {
            if (currentSectionIndex > 0) {
                currentSectionIndex--;
                resetLastLessonDisplay.style.display && resetLastLessonDisplay.style.removeProperty('display');
                sectionNameElement.style.color && (
                    sectionNameElement.style.removeProperty('color'),
                    sectionNameElement.style.removeProperty('text-decoration'),
                    sectionNameElement.style.removeProperty('cursor')
                );
                updateDisplays();
            }
        });
    };

    const loadDataAndInitialize = () => {
        sendMessageToContentScript({ action: 'getSectionData' }, response => {
            if (response.status === 'success') {
                sectionData = response.sectionData;
                getSessionVariable('currentSectionIndex', (value) => {
                    if (value !== undefined) {
                        currentSectionIndex = value;
                        removeSessionVariable('currentSectionIndex');
                    } else {
                        initialIndex = sectionData.indexOf(sectionData.find(section => section.isExpanded));
                        currentSectionIndex = initialIndex !== -1 ? initialIndex : currentSectionIndex;
                    }
                    setSectionVisibility(true);
                    updateDisplays();
                });
            } else {
                document.getElementById('section-name').textContent = 'Erro ao obter dados';
                document.getElementById('time-remaining').textContent = '0m';
                document.getElementById('last-lesson').textContent = 'Nenhuma';
                document.getElementById("reviewSelect").style.display = 'none';
            }
        });
    };

    loadDataAndInitialize();
    setupEventListeners();
});