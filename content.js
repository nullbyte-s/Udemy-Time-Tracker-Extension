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

// TODO: corrigir lógica de obtenção de dados do armazenamento local dentro do namespace da extensão
function highlightBookmarkedLessons() {
    const lessonsMarker = JSON.parse(localStorage.getItem('lessonsMarker'));
    if (!lessonsMarker) return;

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

    const getSectionTitle = () => {
        const expandedSection = document.querySelector('[aria-expanded="true"]');
        if (expandedSection) {
            const titleElement = expandedSection.querySelector('.truncate-with-tooltip--ellipsis--YJw4N');
            return titleElement ? titleElement.textContent.trim() : 'Seção desconhecida';
        }
        return 'Seção desconhecida';
    };

    lessonsMarker.forEach(section => {
        const sectionTitle = section.sessionTitle;
        const lessonsList = section.lessonsList;

        const sectionElements = document.querySelectorAll('[data-purpose="section-heading"]');
        sectionElements.forEach(sectionElement => {
            const currentSectionTitle = getSectionTitle();
            if (currentSectionTitle === sectionTitle) {
                const lessonElements = sectionElement.parentElement.querySelectorAll('[data-purpose^="item-title"]');
                lessonElements.forEach(lessonElement => {
                    if (lessonsList.includes(lessonElement.textContent.trim())) {
                        lessonElement.parentElement.parentNode.classList.toggle('highlight-bookmarkedLessons');
                    }
                });
            }
        });
    });
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
        highlightBookmarkedLessons();
    }
});

window.addEventListener('load', () => {
    highlightBookmarkedLessons();
});