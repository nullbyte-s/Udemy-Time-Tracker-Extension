// Função para formatar o tempo em horas e minutos
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

// Função para obter o tempo selecionado pelo usuário
const getSelectedTime = () => {
    const timeRange = document.getElementById('time-range').value;
    return parseInt(timeRange, 10);
};

// Função para atualizar a exibição do tempo selecionado
const updateSelectedTimeDisplay = () => {
    const selectedTime = getSelectedTime();
    document.getElementById('selected-time').textContent = formatTime(selectedTime);
};

// Função para atualizar o valor máximo do range de tempo com base no tempo restante
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

// Função para converter tempo em minutos a partir de uma string no formato "xh ym"
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

// Função para extrair o número do título de uma lição
function extractNumberFromTitle(title) {
    const match = title.match(/^(\d+)\./);
    return match ? parseInt(match[1], 10) : null;
}

// Função para desmarcar todas as lições após apagar do armazenamento local
function deselectAllOptions(selectElement) {
    for (const option of selectElement.options) {
        option.selected = false;
        option.classList.remove('selected');
    }
}

// Função principal para atualizar a exibição das lições que podem ser assistidas
const updateWatchableLessonsDisplay = (speed = 1) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, { action: "getSectionData" }, (response) => {
            if (response) {
                const sectionTitle = response.sectionTitle || 'Não disponível';
                const remainingTime = response.remainingTime || 0;
                const lessons = response.lessons || [];
                const watchedLessons = lessons.filter(lesson => lesson.time === 'Assistido');
                const maxWatchTime = getSelectedTime();
                const watchableLessons = calculateWatchableLessons(maxWatchTime);
                const lastWatchableLesson = watchableLessons.lastWatchableLesson;
                const reviewSelect = document.getElementById("reviewSelect");

                // Função para atualizar o lessonsMarker no localStorage
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
                                        lessonsList: selectedValues
                                    });
                                }
                            } else {
                                lessonsMarker = [{
                                    sessionTitle: sectionTitle,
                                    lessonsList: selectedValues
                                }];
                            }

                            chrome.runtime.sendMessage({ action: 'updateLessonsMarker', data: lessonsMarker });
                            return lessonsMarker;
                        } else {
                            console.log('Erro ao obter dados:', response.message);
                        }
                    });
                };

                // Função para calcular as lições assistíveis dentro do tempo máximo permitido
                function calculateWatchableLessons(maxMinutes) {
                    let totalMinutes = 0;
                    let lastWatchableLesson = null;
                    const unwatchedLessons = lessons.filter(lesson => lesson.time !== 'Assistido');
                    const watchableLessons = [];

                    for (const lesson of unwatchedLessons) {
                        const lessonMinutes = Math.round(convertTimeToMinutes(lesson.time) / speed);
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
                }

                // Atualiza a exibição das informações
                if (lastWatchableLesson === null) {
                    document.getElementById('last-lesson').textContent = "Seção finalizada";
                    document.getElementById('last-lesson').style.color = '#B0C4DE';
                    document.getElementById('last-lesson').style.fontStyle = 'italic';
                } else {
                    document.getElementById('last-lesson').textContent = `${lastWatchableLesson}`;
                }

                document.getElementById('section-name').textContent = sectionTitle;
                document.getElementById('time-remaining').textContent = formatTime(Math.round(remainingTime / speed));

                for (const lesson of watchedLessons) {
                    const option = document.createElement("option");
                    const lessonNumber = extractNumberFromTitle(lesson.title);
                    option.value = lessonNumber;
                    option.text = lesson.title;
                    reviewSelect.appendChild(option);
                }

                // Evento para o botão de revisão
                document.getElementById('review-btn').addEventListener('click', () => {
                    // chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                    //     chrome.tabs.sendMessage(tabs[0].id, { action: 'bookmarkLesson', message: updateLessonsMarker() });
                    // });
                    chrome.runtime.sendMessage({ action: 'updateLessonsMarker', data: updateLessonsMarker() });
                });

                // Evento para o botão de cancelar revisão
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
                                            console.log('Lições canceladas com sucesso');
                                            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                                                chrome.tabs.sendMessage(tabs[0].id, { action: 'cancelBookmarkLesson', message: lessonsMarker });
                                            });
                                        } else {
                                            console.log('Erro ao cancelar lições:', response.message);
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
                    deselectAllOptions(reviewSelect);
                    // TODO: remover item completo do armazenamento local
                });

                updateRangeMax(Math.round(remainingTime / speed));
            } else {
                document.getElementById('section-name').textContent = 'Erro ao obter dados';
                document.getElementById('time-remaining').textContent = '0m';
                document.getElementById('last-lesson').textContent = 'Nenhuma';
                document.getElementById("reviewSelect").style.display = 'none';
            }
        });
    });
};

// Inicializa os elementos e eventos na DOM
document.addEventListener('DOMContentLoaded', () => {
    const getSpeed = () => parseFloat(document.getElementById('speed-select').value) || 1;
    const select = document.getElementById('reviewSelect');

    const updateDisplays = () => {
        const speed = getSpeed();
        updateSelectedTimeDisplay();
        updateWatchableLessonsDisplay(speed);
    };

    updateDisplays();

    document.getElementById('time-range').addEventListener('input', updateDisplays);
    document.getElementById('speed-select').addEventListener('change', updateDisplays);
    document.getElementById('last-lesson').addEventListener('click', () => {
        const highlightLesson = document.getElementById('last-lesson').textContent.trim();
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            chrome.tabs.sendMessage(tabs[0].id, { action: 'highlightLesson', lesson: highlightLesson });
        });
    });

    select.addEventListener('mousedown', function (event) {
        event.preventDefault();
        const option = event.target;
        if (option.tagName === 'OPTION') {
            const scrollPosition = select.scrollTop;
            option.selected = !option.selected;
            option.classList.toggle('selected', option.selected);
            setTimeout(() => {
                select.scrollTop = scrollPosition;
            }, 0);
        }
    });
});