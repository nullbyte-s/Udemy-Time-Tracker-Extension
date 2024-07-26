const parseTime = (timeStr) => {
    const match = timeStr.match(/(\d+)m/);
    return match ? parseInt(match[1], 10) : 0;
};

const getRemainingTime = () => {
    let totalRemainingTime = 0;

    const items = document.querySelectorAll('[data-purpose^="curriculum-item-"]');
    items.forEach(item => {
        const checkbox = item.querySelector('input[type="checkbox"]');
        const timeElement = item.querySelector('div.curriculum-item-link--metadata--XK804 span');

        if (timeElement && (!checkbox || !checkbox.checked)) {
            const timeStr = timeElement.textContent;
            const time = parseTime(timeStr);
            totalRemainingTime += time;
        }
    });

    return totalRemainingTime;
};

const getSectionTitle = () => {
    const expandedSection = document.querySelector('[aria-expanded="true"]');
    if (expandedSection) {
        const titleElement = expandedSection.querySelector('.truncate-with-tooltip--ellipsis--YJw4N');
        return titleElement ? titleElement.textContent.trim() : 'Seção desconhecida';
    }
    return 'Seção desconhecida';
};

function injectCSS(css) {
    const style = document.createElement('style');
    style.textContent = css;
    document.head.append(style);
}

function highlightLesson(lessonValue) {
    const elementsToSearch = document.querySelectorAll('[data-purpose^="item-title"]');
    const css = `
        .highlight-border {
            color: #9932CC;
            font-weight: bold;
            background: #99bfec35;
            border-radius: 3px;
            border: 0.25rem dashed darkorchid;
            padding: 1vw;
        }
    `;

    injectCSS(css);

    for (const element of elementsToSearch) {
        if (element.textContent.trim() === lessonValue) {
            element.parentElement.parentNode.classList.toggle('highlight-border');
            break;
        }
    };
}

async function checkExpandedSection(maxAttempts, interval) {
    return new Promise(resolve => {
        setTimeout(() => {
            for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                const expandedSection = document.querySelector('.truncate-with-tooltip--ellipsis--YJw4N');
                if (expandedSection !== undefined) {
                    resolve(true);
                    return;
                }
            }
            resolve(false);
        }, interval);
    });
}
async function highlightBookmarkedLessons(lessonsMarker, cancel = false) {
    if (!lessonsMarker) return;

    const sectionElements = await checkExpandedSection(4, 2000);
    if (!sectionElements) {
        console.log('Não foi possível encontrar nenhuma seção aberta');
        return;
    }

    const css = `
        .highlight-bookmarkedLessons {
            color: #F4A460;
            font-weight: bold;
            background: #FFEFD5;
            border-radius: 3px;
            border: 0.25rem dashed darkorchid;
            padding: 1vw;
        }
    `;

    injectCSS(css);

    lessonsMarker.forEach(section => {
        const sectionTitle = section.sessionTitle;
        const lessonsList = section.lessonsList;

        const getAllSectionTitles = () => {
            const expandedSection = document.querySelector('[aria-expanded="true"]');
            if (expandedSection) {
                const sectionElements = document.querySelectorAll('.truncate-with-tooltip--ellipsis--YJw4N');
                if (sectionElements.length > 0) {
                    return Array.from(sectionElements);
                }
            }
            return [];
        };

        getAllSectionTitles().forEach(sectionElement => {
            const currentSectionTitle = sectionElement.textContent.trim();

            if (currentSectionTitle === sectionTitle) {
                const lessonElements = document.querySelectorAll('[data-purpose^="item-title"]');
                lessonElements.forEach(lessonElement => {
                    const lessonText = lessonElement.textContent.trim();
                    const elementToReceiveClass = lessonElement.parentElement.parentNode;

                    if (lessonsList.includes(lessonText)) {
                        if (cancel && elementToReceiveClass.classList.contains('highlight-bookmarkedLessons')) {
                            elementToReceiveClass.classList.remove('highlight-bookmarkedLessons');
                        } else if (!elementToReceiveClass.classList.contains('highlight-bookmarkedLessons')) {
                            elementToReceiveClass.classList.add('highlight-bookmarkedLessons');
                        }
                    } else if (!lessonsList.includes(lessonText) && elementToReceiveClass.classList.contains('highlight-bookmarkedLessons')) {
                        elementToReceiveClass.classList.remove('highlight-bookmarkedLessons');
                    }
                });
            }
        });
    });
}

function showNotification(message, duration = 2000) {
    const notificationContainer = document.createElement('div');
    notificationContainer.className = 'custom-toast';
    const notificationMessage = document.createElement('div');
    notificationMessage.className = 'custom-toast-message';
    notificationMessage.textContent = message;
    notificationContainer.appendChild(notificationMessage);

    document.body.appendChild(notificationContainer);

    const style = document.createElement('style');
    style.textContent = `
        .custom-toast {
            position: fixed;
            top: 10px;
            left: 50%;
            transform: translateX(-50%);
            background-color: #8A2BE2;
            color: #fff;
            padding: 10px 20px;
            border-radius: 5px;
            font-size: 16px;
            z-index: 9999;
            opacity: 0;
            transition: opacity 0.5s ease-in-out;
        }
        .custom-toast-show {
            opacity: 1;
        }
        .custom-toast-message {
            margin: 0;
        }
    `;
    document.head.appendChild(style);
    requestAnimationFrame(() => {
        notificationContainer.classList.add('custom-toast-show');
    });
    setTimeout(() => {
        notificationContainer.classList.remove('custom-toast-show');
        setTimeout(() => {
            notificationContainer.remove();
        }, 500);
    }, duration);
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getSectionData") {
        const sectionTitle = getSectionTitle();
        const remainingTime = getRemainingTime();
        const getLessonData = () => {
            const lessonElements = Array.from(document.querySelectorAll('[data-purpose^="item-title"]'));
            const timeElements = Array.from(document.querySelectorAll('.curriculum-item-link--metadata--XK804'));
            const checkboxElements = Array.from(document.querySelectorAll('input[type="checkbox"]'));
            const uncheckedCheckboxes = checkboxElements.filter(checkbox => !checkbox.checked);
            const uncheckedCheckboxesIds = new Set(uncheckedCheckboxes.map(checkbox => checkbox.id));
            const lessonData = [];
            lessonElements.forEach((item, index) => {
                const checkboxId = checkboxElements[index]?.id;

                if (checkboxId && uncheckedCheckboxesIds.has(checkboxId)) {
                    const timeElement = timeElements[index];
                    const title = item.textContent.trim();
                    const time = timeElement ? timeElement.querySelector('span').textContent.trim() : '0m';

                    lessonData.push({
                        title: title,
                        time: time
                    });
                } else if (checkboxId && !uncheckedCheckboxesIds.has(checkboxId)) {
                    const title = item.textContent.trim();

                    lessonData.push({
                        title: title,
                        time: 'Assistido'
                    });
                }
            });

            return lessonData;
        };

        const lessons = getLessonData();

        sendResponse({ sectionTitle, remainingTime, lessons });
    }

    if (request.action === 'highlightLesson') {
        highlightLesson(request.lesson);
    } else if (request.action === 'bookmarkLesson') {
        highlightBookmarkedLessons(request.message);
        if (request.status === 'updated') {
            showNotification('Marcador de aula atualizado');
        }
    } else if (request.action === 'cancelBookmarkLesson') {
        highlightBookmarkedLessons(request.message, true);
        showNotification('Marcador de aula removido');
    }
});

window.addEventListener('load', () => {
    chrome.runtime.sendMessage({ action: 'updateLessonsMarker' }, response => {
        console.log('Udemy Time Tracker: ' + (response ? response.message : 'Sem resposta'));
    });
});