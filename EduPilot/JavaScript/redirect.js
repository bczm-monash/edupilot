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

function toTeacherReports() {
    window.location.href = "/EduPilot/html/teacher/teacher_CourseReport.html";
}
