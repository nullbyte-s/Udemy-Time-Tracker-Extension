chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'updateLessonsMarker') {
        chrome.storage.local.get('lessonsMarker', (result) => {
            if (request.data) {
                const data = request.data;
                processData(data)
                    .then(() => {
                        sendResponse({ status: 'success' });
                        if (result.lessonsMarker) {
                            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                                chrome.tabs.sendMessage(tabs[0].id, { action: 'bookmarkLesson', message: result.lessonsMarker, status: 'updated' });
                            });
                        }
                    })
                    .catch(error => {
                        sendResponse({ status: 'error', message: error.message });
                    });
            } else {
                if (result.lessonsMarker) {
                    sendResponse({ status: 'success', message: 'Marcador de aulas ativado' });
                } else {
                    sendResponse({ status: 'error', message: 'Marcador de aulas inativo' });
                }
            }
        });
        return true;
    } else if (request.action === 'cancelLessonsMarker') {
        chrome.storage.local.get('lessonsMarker', (result) => {
            if (request.data) {
                const data = request.data;
                removeData(data)
                    .then(() => {
                        sendResponse({ status: 'success' });
                        if (result.lessonsMarker) {
                            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                                chrome.tabs.sendMessage(tabs[0].id, { action: 'cancelBookmarkLesson', message: result.lessonsMarker });
                            });
                        }
                    })
                    .catch(error => {
                        sendResponse({ status: 'error', message: error.message });
                    });
            } else {
                removeData()
                    .then(() => {
                        sendResponse({ status: 'success' });
                    })
                    .catch(error => {
                        sendResponse({ status: 'error', message: error.message });
                    });
            }
        });
        return true;
    } else if (request.action === 'getLessonsMarker') {
        chrome.storage.local.get('lessonsMarker', (result) => {
            if (chrome.runtime.lastError) {
                sendResponse({ status: 'error', message: chrome.runtime.lastError.message });
            } else {
                sendResponse({ status: 'success', data: result.lessonsMarker });
            }
        });
        return true;
    }
    return false;
});

async function processData(data) {
    return new Promise((resolve, reject) => {
        chrome.storage.local.set({ lessonsMarker: data }, () => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError));
            } else {
                resolve();
            }
        });
    });
}

async function removeData(data = null) {
    return new Promise((resolve, reject) => {
        chrome.storage.local.get('lessonsMarker', (result) => {
            if (result.lessonsMarker) {
                let lessonsMarker = result.lessonsMarker;

                if (data !== null) {
                    lessonsMarker = lessonsMarker.map(section => {
                        return {
                            ...section,
                            lessonsList: section.lessonsList.filter(lesson => !data.includes(lesson))
                        };
                    }).filter(section => section.lessonsList.length > 0);

                    chrome.storage.local.set({ lessonsMarker: lessonsMarker }, () => {
                        if (chrome.runtime.lastError) {
                            reject(new Error(chrome.runtime.lastError));
                        } else {
                            resolve();
                            console.log('Removendo da base de dados: ' + JSON.stringify(lessonsMarker));
                        }
                    });
                } else {
                    chrome.storage.local.remove('lessonsMarker', () => {
                        if (chrome.runtime.lastError) {
                            reject(new Error(chrome.runtime.lastError));
                        } else {
                            resolve();
                        }
                    });
                }
            } else {
                resolve();
            }
        });
    });
}