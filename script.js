document.addEventListener('DOMContentLoaded', () => {
    const desktop = document.getElementById('desktop');
    const dock = document.getElementById('dock');
    const contextMenu = document.getElementById('context-menu');
    const addBookmarkBtn = document.getElementById('add-bookmark');
    const addFolderBtn = document.getElementById('add-folder');
    const folderView = document.getElementById('folder-view');
    const folderGrid = document.getElementById('folder-grid');
    const folderName = document.getElementById('folder-name');
    const folderBackBtn = document.getElementById('folder-back-btn');
    const screenIndicator = document.getElementById('screen-indicator');

    let currentScreen = 1;
    let longPressTimer;
    let isDragging = false;
    let dragTarget = null;
    let dragOffsetX, dragOffsetY;
    let jiggleModeActive = false;
    let animationFrameId;
    let latestMouseX, latestMouseY;
    let isSwiping = false;
    let swipeStartX = 0;
    let currentScreenIndex = 0;
    let numScreens = 1;

    // --- Context Menu ---
    document.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        contextMenu.style.top = `${e.clientY}px`;
        contextMenu.style.left = `${e.clientX}px`;
        contextMenu.classList.remove('hidden');
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.app-icon') && !e.target.closest('#context-menu')) {
            stopJiggleMode();
        }
        contextMenu.classList.add('hidden');
    });

    addBookmarkBtn.addEventListener('click', () => {
        const url = prompt('Enter the URL for the bookmark:');
        if (url) {
            const name = prompt('Enter a name for the bookmark:', url.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0]);
            if (name) {
                addBookmark(name, url);
            }
        }
    });

    addFolderBtn.addEventListener('click', () => {
        const name = prompt('Enter a name for the folder:');
        if (name) {
            addFolder(name, []);
        }
    });

    folderBackBtn.addEventListener('click', closeFolder);

    function createBookmarkIcon(name, url, x, y) {
        const appIcon = document.createElement('div');
        appIcon.className = 'app-icon';
        appIcon.dataset.url = url;
        appIcon.innerHTML = `
            <img src="https://www.google.com/s2/favicons?sz=64&domain=${url}" alt="${name}">
            <span>${name}</span>
            <div class="delete-btn">x</div>
        `;

        const screen = document.getElementById(`screen-${currentScreen}`);
        if (x === undefined || y === undefined) {
            const { top, left } = getNextAvailablePosition(screen);
            appIcon.style.top = `${top}px`;
            appIcon.style.left = `${left}px`;
        } else {
            appIcon.style.top = `${y}px`;
            appIcon.style.left = `${x}px`;
        }

        addIconEventListeners(appIcon);
        return appIcon;
    }

    function addBookmark(name, url, x, y) {
        const screen = document.getElementById(`screen-${currentScreen}`);
        const appIcon = createBookmarkIcon(name, url, x, y);
        screen.appendChild(appIcon);
        saveState();
    }

    function createFolderIcon(name, children, x, y) {
        const folderIcon = document.createElement('div');
        folderIcon.className = 'app-icon folder';
        folderIcon.dataset.children = JSON.stringify(children);
        folderIcon.innerHTML = `
            <div class="folder-emoji">📁</div>
            <span>${name}</span>
            <div class="delete-btn">x</div>
        `;

        const screen = document.getElementById(`screen-${currentScreen}`);
        if (x === undefined || y === undefined) {
            const { top, left } = getNextAvailablePosition(screen);
            folderIcon.style.top = `${top}px`;
            folderIcon.style.left = `${left}px`;
        } else {
            folderIcon.style.top = `${y}px`;
            folderIcon.style.left = `${x}px`;
        }

        addIconEventListeners(folderIcon);
        return folderIcon;
    }

    function addFolder(name, children, x, y) {
        const screen = document.getElementById(`screen-${currentScreen}`);
        const folderIcon = createFolderIcon(name, children, x, y);
        screen.appendChild(folderIcon);
        saveState();
    }

    function getNextAvailablePosition(screen) {
        // Simple implementation, will be improved with snapping grid
        const icons = screen.querySelectorAll('.app-icon');
        const xOffset = 20;
        const yOffset = 20;
        const iconWidth = 100;
        const iconHeight = 100;
        const screenWidth = screen.offsetWidth;

        const row = Math.floor(icons.length / Math.floor(screenWidth / iconWidth));
        const col = icons.length % Math.floor(screenWidth / iconWidth);

        return {
            top: yOffset + row * iconHeight,
            left: xOffset + col * iconWidth
        }
    }

    function addIconEventListeners(icon) {
        const deleteBtn = icon.querySelector('.delete-btn');

        icon.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return; // Only left-click

            if (jiggleModeActive) {
                startDrag(e, icon);
                return;
            }

            longPressTimer = setTimeout(() => {
                startJiggleMode();
                longPressTimer = null;
            }, 500);

            startDrag(e, icon);
        });

        icon.addEventListener('click', (e) => {
            if (Math.abs(e.clientX - startX) > 5 || Math.abs(e.clientY - startY) > 5) {
                e.preventDefault();
            } else if (!jiggleModeActive) {
                if (icon.classList.contains('folder')) {
                    openFolder(icon);
                } else if (icon.dataset.url) {
                    window.location.href = icon.dataset.url;
                }
            }
        });

        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            icon.remove();
            saveState();
        });
    }

    let startX, startY;
    desktop.addEventListener('mousedown', (e) => {
        if (e.target.classList.contains('screen')) {
            isSwiping = true;
            swipeStartX = e.clientX;
            desktop.style.transition = 'none';
        }
        startX = e.clientX;
        startY = e.clientY;
    });

    function startDrag(e, icon) {
        isDragging = true;
        dragTarget = icon;
        dragTarget.classList.add('dragging');
        const rect = dragTarget.getBoundingClientRect();
        dragOffsetX = e.clientX - rect.left;
        dragOffsetY = e.clientY - rect.top;
        latestMouseX = e.clientX;
        latestMouseY = e.clientY;

        dragTarget.style.transition = 'none';

        animationFrameId = requestAnimationFrame(dragUpdate);
    }

    function dragUpdate() {
        if (!isDragging) return;

        let newX = latestMouseX - dragOffsetX;
        let newY = latestMouseY - dragOffsetY;

        dragTarget.style.left = `${newX}px`;
        dragTarget.style.top = `${newY}px`;

        animationFrameId = requestAnimationFrame(dragUpdate);
    }

    desktop.addEventListener('mousemove', (e) => {
        if(isSwiping) {
            const diffX = e.clientX - swipeStartX;
            desktop.style.transform = `translateX(${-currentScreenIndex * window.innerWidth + diffX}px)`;
        }

        if (isDragging) {
            latestMouseX = e.clientX;
            latestMouseY = e.clientY;
        }

        if (isDragging && dragTarget) {
            const screenRect = dragTarget.parentElement.getBoundingClientRect();
            const xOnScreen = e.clientX - screenRect.left;
            if (xOnScreen > screenRect.width - 50 && currentScreenIndex === numScreens - 1) {
                const newScreen = addNewScreen();
                dragTarget.remove();
                newScreen.appendChild(dragTarget);
                dragTarget.style.left = '20px'; // Reset position on new screen
                dragOffsetX = e.clientX - dragTarget.getBoundingClientRect().left;
                currentScreenIndex++;
                updateScreen();
            }
        }

        if (longPressTimer && (Math.abs(e.clientX - startX) > 5 || Math.abs(e.clientY - startY) > 5)) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
        }
    });

    desktop.addEventListener('mouseup', (e) => {
        if(isSwiping) {
            isSwiping = false;
            desktop.style.transition = 'transform 0.5s ease-in-out';
            const diffX = e.clientX - swipeStartX;
            if (Math.abs(diffX) > 100) {
                if (diffX > 0 && currentScreenIndex > 0) {
                    currentScreenIndex--;
                } else if (diffX < 0 && currentScreenIndex < numScreens - 1) {
                    currentScreenIndex++;
                }
            }
            updateScreen();
        }

        clearTimeout(longPressTimer);
        longPressTimer = null;

        if (isDragging && dragTarget) {
            cancelAnimationFrame(animationFrameId);
            dragTarget.classList.remove('dragging');

            const dropTarget = getDropTarget(e.clientX, e.clientY, dragTarget);

            if (dropTarget) {
                const dragTargetData = getItemData(dragTarget);
                const dropTargetData = getItemData(dropTarget);

                const newFolderName = prompt("Enter folder name", "New Folder");
                if(newFolderName) {
                    const children = [dragTargetData, dropTargetData];
                    addFolder(newFolderName, children, parseInt(dropTarget.style.left), parseInt(dropTarget.style.top));
                    dragTarget.remove();
                    dropTarget.remove();
                }

            } else {
                // Snap to grid
                const gridSize = 100;
                const x = Math.round(parseInt(dragTarget.style.left) / gridSize) * gridSize + 20;
                const y = Math.round(parseInt(dragTarget.style.top) / gridSize) * gridSize + 20;

                dragTarget.style.transition = 'top 0.2s ease-in-out, left 0.2s ease-in-out';
                dragTarget.style.left = `${x}px`;
                dragTarget.style.top = `${y}px`;

                setTimeout(() => {
                    if(dragTarget) {
                        dragTarget.style.transition = '';
                    }
                }, 200);
            }

            isDragging = false;
            dragTarget = null;
            saveState();
        }
    });

    function getDropTarget(x, y, draggedElement) {
        const elements = document.elementsFromPoint(x, y);
        return elements.find(el => el.classList.contains('app-icon') && el !== draggedElement);
    }

    function getItemData(icon) {
        if (icon.classList.contains('folder')) {
            return {
                type: 'folder',
                name: icon.querySelector('span').textContent,
                children: JSON.parse(icon.dataset.children || '[]'),
                x: icon.style.left,
                y: icon.style.top
            };
        } else {
            return {
                type: 'bookmark',
                name: icon.querySelector('span').textContent,
                url: icon.dataset.url,
                x: icon.style.left,
                y: icon.style.top
            };
        }
    }

    function updateScreen() {
        desktop.style.transform = `translateX(-${currentScreenIndex * 100}vw)`;
        currentScreen = currentScreenIndex + 1;
        updateScreenIndicator();
    }

    function openFolder(folderIcon) {
        const data = getItemData(folderIcon);
        folderName.textContent = data.name;
        folderGrid.innerHTML = '';

        data.children.forEach(item => {
            let icon;
            if (item.type === 'bookmark') {
                icon = createBookmarkIcon(item.name, item.url);
            } else if (item.type === 'folder') {
                icon = createFolderIcon(item.name, item.children);
            }
            if (icon) {
                // remove position so it flows in the grid
                icon.style.position = 'relative';
                icon.style.top = 'auto';
                icon.style.left = 'auto';
                folderGrid.appendChild(icon);
            }
        });

        folderView.classList.remove('hidden');
        desktop.classList.add('hidden');
        dock.classList.add('hidden');
    }

    function closeFolder() {
        folderView.classList.add('hidden');
        desktop.classList.remove('hidden');
        dock.classList.remove('hidden');
        folderGrid.innerHTML = '';
    }

    function startJiggleMode() {
        jiggleModeActive = true;
        document.querySelectorAll('.app-icon').forEach(icon => {
            icon.classList.add('jiggle');
        });
    }

    function stopJiggleMode() {
        if (!jiggleModeActive) return;
        jiggleModeActive = false;
        document.querySelectorAll('.app-icon').forEach(icon => {
            icon.classList.remove('jiggle');
        });
    }


    function addNewScreen() {
        const newScreen = document.createElement('div');
        numScreens++;
        newScreen.id = `screen-${numScreens}`;
        newScreen.className = 'screen';
        desktop.appendChild(newScreen);
        updateScreenIndicator();
        return newScreen;
    }

    function saveState() {
        const data = {
            screens: {}
        };
        document.querySelectorAll('.screen').forEach((screen, index) => {
            const screenId = `screen-${index + 1}`;
            data.screens[screenId] = [];
            screen.querySelectorAll('.app-icon').forEach(icon => {
                data.screens[screenId].push(getItemData(icon));
            });
        });
        localStorage.setItem('dashboardState', JSON.stringify(data));
    }

    function loadState() {
        const data = JSON.parse(localStorage.getItem('dashboardState'));
        if (data && data.screens) {
            numScreens = Object.keys(data.screens).length;
            Object.keys(data.screens).forEach(screenId => {
                const screenData = data.screens[screenId];
                let screen = document.getElementById(screenId);
                if (!screen) {
                    screen = document.createElement('div');
                    screen.id = screenId;
                    screen.className = 'screen';
                    desktop.appendChild(screen);
                }
                screenData.forEach(item => {
                    let icon;
                    if (item.type === 'bookmark') {
                        icon = createBookmarkIcon(item.name, item.url, parseInt(item.x), parseInt(item.y));
                    } else if (item.type === 'folder') {
                        icon = createFolderIcon(item.name, item.children, parseInt(item.x), parseInt(item.y));
                    }
                    if(icon) {
                        screen.appendChild(icon);
                    }
                });
            });
        }
    }

    function updateScreenIndicator() {
        screenIndicator.innerHTML = '';
        for (let i = 0; i < numScreens; i++) {
            const dot = document.createElement('div');
            dot.className = 'screen-indicator-dot';
            if (i === currentScreenIndex) {
                dot.classList.add('active');
            }
            screenIndicator.appendChild(dot);
        }
    }

    loadState();
    updateScreenIndicator();
});
