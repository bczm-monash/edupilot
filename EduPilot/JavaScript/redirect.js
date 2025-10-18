const ADMIN_MODE_KEY = 'adminMode';

function setAdminModeFlag() {
    try {
        sessionStorage.setItem(ADMIN_MODE_KEY, 'true');
    } catch (err) {
        // sessionStorage might be unavailable; ignore
    }
}

function clearAdminModeFlag() {
    try {
        sessionStorage.removeItem(ADMIN_MODE_KEY);
    } catch (err) {
        // no-op when storage is unavailable
    }
}

function isAdminModeActive() {
    try {
        return sessionStorage.getItem(ADMIN_MODE_KEY) === 'true';
    } catch (err) {
        return false;
    }
}

function toLogin() {
    clearAdminModeFlag();
    window.location.href = "/EduPilot/html/login.html";
}

function toRegister() {
    window.location.href = "/EduPilot/html/registration.html";
}

function toSCourse() {
    window.location.href = "/EduPilot/html/student/sCourse.html";
}

function toSAvailableCourses() {
    window.location.href = "/EduPilot/html/student/sCourse_available.html";
}

function toSClassroom() {
    window.location.href = "/EduPilot/html/student/sClassroom.html";
}

function toSWelcome() {
    window.location.href = "/EduPilot/html/student/sWelcomePage.html";
}

function toAvailableClassrooms() {
    window.location.href = "/EduPilot/html/student/sClassroom_available.html";
}

function toTCourse() {
    window.location.href = "/EduPilot/html/teacher/tCourse.html";
}

function toTClassroom() {
    window.location.href = "/EduPilot/html/teacher/tClassroom.html";
}

function toLesson() {
    window.location.href = "/EduPilot/html/teacher/lessons.html";
}

function toCreateLesson() {
    window.location.href = "/EduPilot/html/teacher/createLesson.html";
}

function toEditLesson() {
    window.location.href = "/EduPilot/html/teacher/editLesson.html";
}

function toCreateClassroom() {
    window.location.href = "/EduPilot/html/teacher/create_classroom.html";
}

function toAdmin() {
    clearAdminModeFlag();
    window.location.href = "/EduPilot/html/admin/adminpage.html";
}

function toAWelcome() {
    window.location.href = "/EduPilot/html/admin/adminWelcomePage.html";
}

function toAdminLesson() {
    setAdminModeFlag();
    toLesson();
}

function toAdminCourse() {
    setAdminModeFlag();
    toTCourse();
}

function toAdminClassroom() {
    setAdminModeFlag();
    toTClassroom();
}

function toAdminStudentList() {
    window.location.href = "/EduPilot/html/admin/list_Students.html";
}

function toAdminInstructorList() {
    window.location.href = "/EduPilot/html/admin/list_Instructors.html";
}

function toAdminReports() {
    window.location.href = "/EduPilot/html/admin/reports.html";
}

function toTStudents() {
    window.location.href = "/EduPilot/html/teacher/tStudents.html";
}

function toTeacherAdmin() {
    window.location.href = "/EduPilot/html/teacher/tAdmin.html";
}

function toTeacherReports() {
    window.location.href = "/EduPilot/html/teacher/teacher_CourseReport.html";
}

function toTeacherArchivedCourses() {
    window.location.href = "/EduPilot/html/teacher/archived_courses.html";
}

function toTeacherArchivedClassrooms() {
    window.location.href = "/EduPilot/html/teacher/archived_classrooms.html";
}

function toTeacherClassroomGrades(id) {
    if (!id) return;
    window.location.href = `/EduPilot/html/teacher/classroom_grades.html?id=${encodeURIComponent(id)}`;
}

function toTWelcome() {
    window.location.href = "/EduPilot/html/teacher/tWelcomePage.html";
}

(function () {
    const PRESET_GROUPS = [
        {
            label: 'Colours',
            options: [
                { name: 'Default', value: null, type: 'default' },
                { name: 'Sky', value: '#9bdbf7ff', type: 'color' },
                { name: 'Lavender', value: '#cea4f5ff', type: 'color' },
                { name: 'Emerald', value: '#a8e9d3ff', type: 'color' },
                { name: 'Slate', value: '#1f2937', type: 'color' },
                { name: 'Sunset', value: '#ffe4d1ff', type: 'color' },
                { name: 'Blush', value: '#f6dbdfff', type: 'color' },
            ],
        },
        {
            label: 'Photos',
            options: [
                {
                    name: 'Aurora',
                    value: 'image|/EduPilot/Images/background_pic/aurora.svg',
                    type: 'image',
                    preview: '/EduPilot/Images/background_pic/aurora.svg',
                },
                {
                    name: 'Sunrise',
                    value: 'image|/EduPilot/Images/background_pic/sunrise.svg',
                    type: 'image',
                    preview: '/EduPilot/Images/background_pic/sunrise.svg',
                },
                {
                    name: 'Ocean',
                    value: 'image|/EduPilot/Images/background_pic/ocean.svg',
                    type: 'image',
                    preview: '/EduPilot/Images/background_pic/ocean.svg',
                },
            ],
        },
    ];

    const STATE = {
        supabase: null,
        userId: null,
        currentValue: null,
        toggleBtn: null,
        currentTheme: 'default',
        panelEl: null,
        swatchMap: new Map(),
        initialised: false,
        customGroupWrapper: null,
        customContainer: null,
    };

function waitForSupabase(timeoutMs = 6000) {
    if (window.supabase) return Promise.resolve(window.supabase);
    return new Promise((resolve, reject) => {
        const onReady = (event) => {
            cleanup();
                resolve(event?.detail?.supabase || window.supabase);
            };
            const cleanup = () => {
                document.removeEventListener('supabase-ready', onReady);
                if (timer) clearTimeout(timer);
            };
            document.addEventListener('supabase-ready', onReady, { once: true });
            const timer = timeoutMs
                ? setTimeout(() => {
                    cleanup();
                    reject(new Error('Supabase client not available.'));
                }, timeoutMs)
                : null;
        });
    }

function valueKey(value) {
    if (value === null || value === undefined || value === '') return '__default__';
    const trimmed = String(value).trim();
    if (trimmed.startsWith('#')) return trimmed.toLowerCase();
    return trimmed;
}

const THEME_NAME_MAP = new Map([
    ['__default__', 'default'],
    ['#9bdbf7ff', 'sky'],
    ['#cea4f5ff', 'lavender'],
    ['#a8e9d3ff', 'emerald'],
    ['#1f2937', 'slate'],
    ['#ffe4d1ff', 'sunset'],
    ['#f6dbdfff', 'blush'],
    ['image|/EduPilot/Images/background_pic/aurora.svg', 'aurora'],
    ['image|/EduPilot/Images/background_pic/sunrise.svg', 'sunrise'],
    ['image|/EduPilot/Images/background_pic/ocean.svg', 'ocean'],
]);

const DARK_BACKGROUND_VALUES = new Set(
    ['#1f2937', 'image|/EduPilot/Images/background_pic/aurora.svg'].map((value) => valueKey(value))
);

function isDarkBackground(value) {
    return DARK_BACKGROUND_VALUES.has(valueKey(value));
}

function applyContrastMode(value) {
    const body = document.body;
    if (!body) return;
    body.classList.toggle('theme-dark', isDarkBackground(value));
}

function themeNameForValue(value) {
    const key = valueKey(value);
    return THEME_NAME_MAP.get(key) || 'default';
}

function applyThemeTag(value) {
    const body = document.body;
    if (!body) return;
    const themeName = themeNameForValue(value);
    if (STATE.currentTheme === themeName) return;
    STATE.currentTheme = themeName;
    if (themeName === 'default') {
        delete body.dataset.appTheme;
    } else {
        body.dataset.appTheme = themeName;
    }
}

function isImageValue(value) {
    if (!value) return false;
    const trimmed = String(value).trim();
    return (
        trimmed.startsWith('image|') ||
            /^url\(/i.test(trimmed) ||
            /^https?:\/\//i.test(trimmed) ||
            trimmed.startsWith('data:')
        );
    }

    function previewForValue(value) {
        if (!value) return '';
        const trimmed = String(value).trim();
        if (trimmed.startsWith('image|')) {
            return trimmed.slice('image|'.length);
        }
        return trimmed;
    }

    function applyVisualBackground(value) {
        const body = document.body;
        if (!body) return;

        applyThemeTag(value);
        applyContrastMode(value);

        body.style.removeProperty('background');
        body.style.removeProperty('background-color');
        body.style.removeProperty('background-image');
        body.style.removeProperty('background-size');
        body.style.removeProperty('background-position');
        body.style.removeProperty('background-repeat');
        body.style.removeProperty('background-attachment');

        if (!value) {
            return;
        }

        const trimmed = String(value).trim();
        if (trimmed.startsWith('image|')) {
            const path = trimmed.slice('image|'.length);
            body.style.setProperty('background-image', `url("${path}")`);
            body.style.setProperty('background-size', 'cover');
            body.style.setProperty('background-position', 'center');
            body.style.setProperty('background-repeat', 'no-repeat');
            body.style.setProperty('background-attachment', 'fixed');
            body.style.setProperty('background-color', 'transparent');
            return;
        }

        if (/^url\(/i.test(trimmed)) {
            body.style.setProperty('background-image', trimmed);
            body.style.setProperty('background-size', 'cover');
            body.style.setProperty('background-position', 'center');
            body.style.setProperty('background-repeat', 'no-repeat');
            body.style.setProperty('background-attachment', 'fixed');
            body.style.setProperty('background-color', 'transparent');
            return;
        }

        if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('data:')) {
            body.style.setProperty('background-image', `url("${trimmed}")`);
            body.style.setProperty('background-size', 'cover');
            body.style.setProperty('background-position', 'center');
            body.style.setProperty('background-repeat', 'no-repeat');
            body.style.setProperty('background-attachment', 'fixed');
            body.style.setProperty('background-color', 'transparent');
            return;
        }

        body.style.setProperty('background', trimmed);
        body.style.setProperty('background-color', trimmed);
        body.style.removeProperty('background-attachment');
    }

    function setActiveSwatch(value) {
        const targetKey = valueKey(value);
        let matched = false;
        STATE.swatchMap.forEach((btn, key) => {
            const isActive = key === targetKey;
            btn.classList.toggle('is-active', isActive);
            btn.setAttribute('aria-pressed', String(isActive));
            if (isActive) matched = true;
        });
        if (!matched) {
            const defaultBtn = STATE.swatchMap.get('__default__');
            if (defaultBtn) {
                defaultBtn.classList.add('is-active');
                defaultBtn.setAttribute('aria-pressed', 'true');
            }
        }
    }

    async function persistBackground(value) {
        if (!STATE.supabase || !STATE.userId) return;
        const payload = value ? { users_background: value } : { users_background: null };
        const { error } = await STATE.supabase
            .from('users')
            .update(payload)
            .eq('users_id', STATE.userId);

        if (error) throw error;
    }

    function handleDocumentClick(event) {
        if (!STATE.panelEl || !STATE.toggleBtn) return;
        if (STATE.panelEl.hidden) return;
        if (STATE.panelEl.contains(event.target) || STATE.toggleBtn.contains(event.target)) {
            return;
        }
        STATE.panelEl.hidden = true;
        STATE.toggleBtn.setAttribute('aria-expanded', 'false');
    }

    function createSwatch(option, container) {
        if (!container) return;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'background-swatch';
        btn.dataset.value = option.value ?? '';
        btn.setAttribute('aria-pressed', 'false');
        btn.setAttribute('aria-label', option.name);

        const preview = document.createElement('span');
        preview.className = 'background-swatch-preview';
        if (option.type === 'image') {
            let backgroundValue = '';
            if (option.value && String(option.value).trim().startsWith('image|')) {
                const path = String(option.value).trim().slice('image|'.length);
                backgroundValue = `url("${path}")`;
            } else if (option.preview) {
                const raw = String(option.preview).trim();
                backgroundValue = /^url\(/i.test(raw) ? raw : `url("${raw}")`;
            }
            if (backgroundValue) {
                preview.style.backgroundImage = backgroundValue;
            }
            btn.classList.add('background-swatch--image');
        } else if (option.value) {
            const fill = option.preview || option.value;
            if (typeof option.value === 'string' && option.value.trim().startsWith('#')) {
                preview.style.setProperty('--swatch-color', option.value);
            }
            preview.style.background = fill;
        } else {
            btn.classList.add('background-swatch--default');
        }

        const label = document.createElement('span');
        label.className = 'background-swatch-label';
        label.textContent = option.name;

        btn.appendChild(preview);
        btn.appendChild(label);

        btn.addEventListener('click', async () => {
            const selectedValue = option.value ?? null;
            const currentNorm = valueKey(STATE.currentValue);
            const nextNorm = valueKey(selectedValue);
            if (currentNorm === nextNorm) {
                STATE.panelEl.hidden = true;
                STATE.toggleBtn.setAttribute('aria-expanded', 'false');
                return;
            }

            const previousValue = STATE.currentValue;
            applyVisualBackground(selectedValue);
            setActiveSwatch(selectedValue);

            try {
                await persistBackground(selectedValue);
                STATE.currentValue = selectedValue;
            } catch (err) {
                console.error('Failed to save background preference:', err);
                alert('Unable to save your background preference. Please try again.');
                applyVisualBackground(previousValue);
                setActiveSwatch(previousValue);
            } finally {
                STATE.panelEl.hidden = true;
                STATE.toggleBtn.setAttribute('aria-expanded', 'false');
            }
        });

        const normKey = valueKey(option.value);
        STATE.swatchMap.set(normKey, btn);
        container.appendChild(btn);
    }

    function ensureCustomSwatch(value) {
        const norm = valueKey(value);
        if (!norm) return;
        if (STATE.swatchMap.has(norm)) return;
        if (!STATE.customContainer || !STATE.customGroupWrapper) return;
        const isImage = isImageValue(value);
        createSwatch({
            name: 'Saved',
            value,
            type: isImage ? 'image' : 'color',
            preview: isImage ? previewForValue(value) : value,
        }, STATE.customContainer);
        const btn = STATE.swatchMap.get(norm);
        if (btn) btn.classList.add('background-swatch--custom');
        if (STATE.customGroupWrapper && STATE.customContainer?.childElementCount > 0) {
            STATE.customGroupWrapper.hidden = false;
        }
    }

    function createBackgroundControls() {
        if (STATE.initialised) return;
        if (!document.body) return;

        const container = document.createElement('div');
        container.className = 'background-picker';
        container.dataset.backgroundPicker = 'true';

        const toggleBtn = document.createElement('button');
        toggleBtn.type = 'button';
        toggleBtn.className = 'background-toggle';
        toggleBtn.innerHTML = '<span aria-hidden="true">🎨</span><span class="background-toggle-label">Theme</span>';
        toggleBtn.setAttribute('aria-expanded', 'false');
        toggleBtn.setAttribute('aria-controls', 'background-panel');
        toggleBtn.title = 'Change background';

        const panel = document.createElement('div');
        panel.className = 'background-panel';
        panel.id = 'background-panel';
        panel.hidden = true;
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-label', 'Choose background');

        const heading = document.createElement('p');
        heading.className = 'background-panel-title';
        heading.textContent = 'Choose a background';

        panel.appendChild(heading);

        STATE.swatchMap.clear();

        PRESET_GROUPS.forEach((group) => {
            const wrapper = document.createElement('div');
            wrapper.className = 'background-group';

            const title = document.createElement('p');
            title.className = 'background-group-title';
            title.textContent = group.label;

            const grid = document.createElement('div');
            grid.className = 'background-swatches';

            wrapper.appendChild(title);
            wrapper.appendChild(grid);
            panel.appendChild(wrapper);

            group.options.forEach((option) => createSwatch(option, grid));
        });

        const customWrapper = document.createElement('div');
        customWrapper.className = 'background-group background-group--custom';
        customWrapper.hidden = true;

        const customTitle = document.createElement('p');
        customTitle.className = 'background-group-title';
        customTitle.textContent = 'Your saved background';

        const customGrid = document.createElement('div');
        customGrid.className = 'background-swatches';

        customWrapper.appendChild(customTitle);
        customWrapper.appendChild(customGrid);
        panel.appendChild(customWrapper);

        container.appendChild(toggleBtn);
        container.appendChild(panel);

        document.body.appendChild(container);

        STATE.toggleBtn = toggleBtn;
        STATE.panelEl = panel;
        STATE.customGroupWrapper = customWrapper;
        STATE.customContainer = customGrid;

        ensureCustomSwatch(STATE.currentValue);
        if (STATE.customGroupWrapper && STATE.customContainer && !STATE.customContainer.childElementCount) {
            STATE.customGroupWrapper.hidden = true;
        }
        setActiveSwatch(STATE.currentValue);

        toggleBtn.addEventListener('click', () => {
            const isHidden = STATE.panelEl.hidden;
            STATE.panelEl.hidden = !isHidden;
            STATE.toggleBtn.setAttribute('aria-expanded', String(isHidden));
        });

        document.addEventListener('click', handleDocumentClick);
        STATE.initialised = true;
    }

    async function loadBackgroundPreference() {
        try {
            const [{ data: authData, error: authError }, client] = await Promise.all([
                STATE.supabase.auth.getUser(),
                Promise.resolve(STATE.supabase),
            ]);
            if (authError) throw authError;
            if (!authData?.user) {
                return;
            }

            STATE.userId = authData.user.id;

            const { data, error } = await client
                .from('users')
                .select('users_background')
                .eq('users_id', STATE.userId)
                .maybeSingle();

            if (error) {
                console.warn('Failed to load background preference:', error);
                return;
            }

            const stored = data?.users_background || null;
            STATE.currentValue = stored;
            applyVisualBackground(stored);
        } catch (err) {
            console.error('Background manager initialisation failed:', err);
        }
    }

    function isPickerDisabledForPage() {
        return document.body?.dataset?.disableTheme === 'true';
    }

    async function initialiseBackgroundManager() {
        if (isPickerDisabledForPage()) return;
        if (STATE.supabase) return;
        try {
            STATE.supabase = await waitForSupabase();
        } catch (err) {
            console.warn('Supabase unavailable, skipping background manager.');
            return;
        }

        await loadBackgroundPreference();
        if (!STATE.userId) {
            return;
        }
        createBackgroundControls();
        setActiveSwatch(STATE.currentValue);
    }

    if (typeof window !== 'undefined') {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initialiseBackgroundManager);
        } else {
            initialiseBackgroundManager();
        }
    }
})();
