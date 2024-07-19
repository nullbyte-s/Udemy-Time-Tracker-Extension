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
                }
            });

            return lessonData;
        };

        const lessons = getLessonData();

        sendResponse({ sectionTitle, remainingTime, lessons });
    }
});