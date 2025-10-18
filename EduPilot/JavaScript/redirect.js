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
    const COLOR_OPTIONS = [
        { name: 'Default', value: null },
        { name: 'Sky', value: '#9bdbf7ff' },
        { name: 'Lavender', value: '#cea4f5ff' },
        { name: 'Emerald', value: '#a8e9d3ff' },
        { name: 'Slate', value: '#1f2937' },
        { name: 'Sunset', value: '#ffe4d1ff' },
        { name: 'Blush', value: '#f6dbdfff' },
    ];

    const STATE = {
        supabase: null,
        userId: null,
        currentValue: null,
        toggleBtn: null,
        panelEl: null,
        swatchListEl: null,
        swatchMap: new Map(),
        initialised: false,
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

    function normaliseValue(value) {
        if (value === null || value === undefined) return null;
        return String(value).trim().toLowerCase();
    }

    function applyVisualBackground(value) {
        const body = document.body;
        if (!body) return;

        if (!value) {
            body.style.removeProperty('background');
            body.style.removeProperty('background-color');
            body.style.removeProperty('background-image');
            body.style.removeProperty('background-size');
            body.style.removeProperty('background-position');
            return;
        }

        const trimmed = String(value).trim();
        body.style.setProperty('background', trimmed);
        body.style.setProperty('background-color', trimmed);
        body.style.setProperty('background-image', 'none');
    }

    function setActiveSwatch(value) {
        const targetKey = normaliseValue(value);
        STATE.swatchMap.forEach((btn, key) => {
            const isActive = key === targetKey;
            btn.classList.toggle('is-active', isActive);
            btn.setAttribute('aria-pressed', String(isActive));
        });
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

    function createSwatch(option) {
        if (!STATE.swatchListEl) return;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'background-swatch';
        btn.dataset.value = option.value ?? '';
        btn.setAttribute('aria-pressed', 'false');
        btn.setAttribute('aria-label', option.name);

        const preview = document.createElement('span');
        preview.className = 'background-swatch-preview';
        if (option.value) {
            preview.style.setProperty('--swatch-color', option.value);
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
            const currentNorm = normaliseValue(STATE.currentValue);
            const nextNorm = normaliseValue(selectedValue);
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

        const normKey = normaliseValue(option.value);
        STATE.swatchMap.set(normKey, btn);
        STATE.swatchListEl.appendChild(btn);
    }

    function ensureCustomSwatch(value) {
        const norm = normaliseValue(value);
        if (!norm) return;
        if (STATE.swatchMap.has(norm)) return;
        createSwatch({
            name: 'Saved',
            value,
        });
        const btn = STATE.swatchMap.get(norm);
        if (btn) btn.classList.add('background-swatch--custom');
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

        const swatchList = document.createElement('div');
        swatchList.className = 'background-swatches';

        panel.appendChild(heading);
        panel.appendChild(swatchList);
        container.appendChild(toggleBtn);
        container.appendChild(panel);

        document.body.appendChild(container);

        STATE.toggleBtn = toggleBtn;
        STATE.panelEl = panel;
        STATE.swatchListEl = swatchList;

        COLOR_OPTIONS.forEach(createSwatch);
        ensureCustomSwatch(STATE.currentValue);
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

    async function initialiseBackgroundManager() {
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
