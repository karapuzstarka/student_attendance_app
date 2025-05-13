document.addEventListener('DOMContentLoaded', () => {
    const authForm = document.getElementById('auth-form');

    const buttonStyle = 'style="display:block;width:100%;margin-bottom:10px;padding:12px;border:none;border-radius:8px;background-color:#f1f1f1;color:#333;font-size:16px;cursor:pointer;transition:background-color 0.3s"';
    const buttonHoverScript = `
        const buttons = document.querySelectorAll('button');
        buttons.forEach(btn => {
            btn.addEventListener('mouseenter', () => btn.style.backgroundColor = '#ddd');
            btn.addEventListener('mouseleave', () => btn.style.backgroundColor = '#f1f1f1');
        });
    `;

    function showRegisterForm() {
        authForm.innerHTML = `
            <h2>Регистрация пользователя</h2>
            <form id="register-form">
                <input type="text" id="register-full-name" placeholder="ФИО" required>
                <select id="register-role" required>
                    <option value="">Выберите роль</option>
                    <option value="student">Студент</option>
                    <option value="teacher">Преподаватель</option>
                </select>
                <div id="role-specific-fields"></div>
                <p><strong>Сгенерированный пароль:</strong> <span id="generated-password"></span></p>
                <button type="submit">Зарегистрировать</button>
                <button type="button" id="cancel-register">Отменить</button>
            </form>
        `;

        const roleSelect = document.getElementById('register-role');
        roleSelect.addEventListener('change', async () => {
            const role = roleSelect.value;
            const container = document.getElementById('role-specific-fields');
            container.innerHTML = '';

            const groups = await fetch('http://127.0.0.1:5000/groups').then(res => res.json());
            const disciplines = await fetch('http://127.0.0.1:5000/disciplines').then(res => res.json());

            if (role === 'student') {
                container.innerHTML = `
                    <label>Группа:
                        <select id="register-group-id" required>
                            ${groups.map(g => `<option value="${g.id}">${g.name}</option>`).join('')}
                        </select>
                    </label>
                  <label>Дисциплины:</label>
<div id="discipline-checkboxes" class="checkbox-group">
    ${disciplines.map(d => `
        <label class="checkbox-item">
            <input type="checkbox" value="${d.id}"> ${d.name}
        </label>
    `).join('')}
</div>
                `;
            } else if (role === 'teacher') {
                container.innerHTML = `
             <label>Группы:</label>
<div id="group-checkboxes" class="checkbox-group">

    ${groups.map(g => `
        <label class="checkbox-item">
            <input type="checkbox" value="${g.id}"> ${g.name}
        </label>
    `).join('')}
</div>

<label>Дисциплины:</label>
<div id="discipline-checkboxes" class="checkbox-group">
    ${disciplines.map(d => `
        <label class="checkbox-item">
            <input type="checkbox" value="${d.id}"> ${d.name}
        </label>
    `).join('')}
</div>
                `;
            }

            const password = generatePassword();
            document.getElementById('generated-password').textContent = password;
            document.getElementById('register-form').dataset.generatedPassword = password;
        });

        document.getElementById('register-form').addEventListener('submit', handleRegisterSubmit);
        document.getElementById('cancel-register').addEventListener('click', showAdminPage);
    }

    function handleRegisterSubmit(e) {
        e.preventDefault();
        const fullName = document.getElementById('register-full-name').value;
        const role = document.getElementById('register-role').value;
        const password = e.target.dataset.generatedPassword;

        let groupId = null;
        let groupIds = [];
    
        const disciplineIds = Array.from(
            document.querySelectorAll('#discipline-checkboxes input[type=\"checkbox\"]:checked')
        ).map(cb => parseInt(cb.value));

        if (role === 'student') {
            groupId = parseInt(document.getElementById('register-group-id').value);
        } else if (role === 'teacher') {
            groupIds = Array.from(
                document.querySelectorAll('#group-checkboxes input[type="checkbox"]:checked')
            ).map(cb => parseInt(cb.value));
        }

        const payload = {
            full_name: fullName,
            role,
            password,
            group_id: groupId,
            group_ids: groupIds,
            discipline_ids: disciplineIds
        };

        fetch('http://127.0.0.1:5000/register_user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
        .then(response => response.json())
        .then(data => {
            alert(`Пользователь зарегистрирован.\nПароль: ${password}`);
            showAdminPage();
        });
    }

    function generatePassword(length = 8) {
        const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    }

    function showAddGroupForm() {
        fetch('http://127.0.0.1:5000/users')
            .then(res => res.json())
            .then(users => {
                const students = users.filter(u => u.role === 'student');
                authForm.innerHTML = `
                    <h2>Добавить группу</h2>
                    <form id="group-form">
                        <input type="text" id="group-name" placeholder="Номер группы" required>
                        <label>Студенты:
                     <div id="group-student-checkboxes" class="checkbox-group">
    ${students.map(s => `
        <label class="checkbox-item">
            <input type="checkbox" value="${s.id}"> ${s.full_name}
        </label>
    `).join('')}
</div>
                        </label>
                        <button type="submit">Сохранить</button>
                        <button type="button" id="cancel-group">Отменить</button>
                    </form>
                `;
                document.getElementById('group-form').addEventListener('submit', handleAddGroup);
                document.getElementById('cancel-group').addEventListener('click', showAdminPage);
            });
    }

    function handleAddGroup(e) {
        e.preventDefault();
        const name = document.getElementById('group-name').value;
        const studentIds = Array.from(
            document.querySelectorAll('#group-student-checkboxes input[type="checkbox"]:checked')
        ).map(cb => parseInt(cb.value));

        fetch('http://127.0.0.1:5000/create_group', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, student_ids: studentIds })
        })
        .then(res => res.json())
        .then(() => {
            alert('Группа добавлена');
            showAdminPage();
        });
    }

    function showAddDisciplineForm() {
        Promise.all([
            fetch('http://127.0.0.1:5000/users').then(res => res.json()),
            fetch('http://127.0.0.1:5000/groups').then(res => res.json())
        ]).then(([users, groups]) => {
            const teachers = users.filter(u => u.role === 'teacher');

            authForm.innerHTML = `
                <h2>Добавить дисциплину</h2>
                <form id="discipline-form">
                    <input type="text" id="discipline-name" placeholder="Название дисциплины" required>
                    <label>Преподаватель:
                        <select id="discipline-teacher">
                            <option value="">(не выбрано)</option>
                            ${teachers.map(t => `<option value="${t.id}">${t.full_name}</option>`).join('')}
                        </select>
                    </label>
                    <label>Группы:
                    <div id="discipline-group-checkboxes" class="checkbox-group">
    ${groups.map(g => `
        <label class="checkbox-item">
            <input type="checkbox" value="${g.id}"> ${g.name}
        </label>
    `).join('')}
</div>
                    </label>
                    <button type="submit">Сохранить</button>
                    <button type="button" id="cancel-discipline">Отменить</button>
                </form>
            `;

            document.getElementById('discipline-form').addEventListener('submit', handleAddDiscipline);
            document.getElementById('cancel-discipline').addEventListener('click', showAdminPage);
        });
    }

    function handleAddDiscipline(e) {
    e.preventDefault();

    const name = document.getElementById('discipline-name').value;
    const teacherId = document.getElementById('discipline-teacher').value || null;
    const groupIds = Array.from(
        document.querySelectorAll('#discipline-group-checkboxes input[type="checkbox"]:checked')
    ).map(cb => parseInt(cb.value));

    const payload = {
        name,
        teacher_id: teacherId,
        group_ids: groupIds
    };

    fetch('http://127.0.0.1:5000/create_discipline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(data => {
        // Покажем сообщение о том, что дисциплина добавлена
        showMessage("Дисциплина успешно добавлена!", "success");
    })
    .catch(err => {
        console.log('Ошибка:', err);
        showMessage("Ошибка при добавлении дисциплины", "error");
    });
}

// Функция для показа сообщения
function showMessage(message, type) {
    const messageBox = document.createElement('div');
    messageBox.classList.add('message-box', type);
    messageBox.innerHTML = message;

    // Добавляем message box на страницу
    document.body.appendChild(messageBox);

    // Убираем сообщение через 3 секунды
    setTimeout(() => {
        messageBox.remove();
    }, 3000);
}



function showUsersList() {
    fetch('http://127.0.0.1:5000/users')
        .then(res => res.json())
        .then(users => {
            let html = '<h2>Список пользователей</h2>';
            html += `
                <table style="width: 100%; border-collapse: collapse; border: 1px solid #ccc;">
                    <thead style="background: #f9f9f9;">
                        <tr>
                            <th style="padding: 10px; border: 1px solid #ccc;">ID</th>
                            <th style="padding: 10px; border: 1px solid #ccc;">ФИО</th>
                            <th style="padding: 10px; border: 1px solid #ccc;">Роль</th>
                            <th style="padding: 10px; border: 1px solid #ccc;">Группа</th>
                            <th style="padding: 10px; border: 1px solid #ccc;">Пароль</th>
                  
                        </tr>
                    </thead>
                    <tbody>
            `;
            users.forEach(user => {
                const userDisciplines = user.disciplines ? user.disciplines.map(d => d.name).join(', ') : '-';
                html += `
                    <tr>
                        <td style="padding: 8px; border: 1px solid #ccc;">${user.id}</td>
                        <td style="padding: 8px; border: 1px solid #ccc;">${user.full_name}</td>
                        <td style="padding: 8px; border: 1px solid #ccc;">${user.role}</td>
                        <td style="padding: 8px; border: 1px solid #ccc;">${user.group ? user.group.name : '-'}</td>
                        <td style="padding: 8px; border: 1px solid #ccc;">${user.password}</td>
                        <td style="padding: 8px; border: 1px solid #ccc;">
                  
                        </td>
                    </tr>
                `;
            });
            html += '</tbody></table>';
            html += `<br><button id="back-to-admin" ${buttonStyle}>Назад</button>`;
            authForm.innerHTML = html;
            document.getElementById('back-to-admin').addEventListener('click', showAdminPage);
// Убедитесь, что функция deleteUser доступна
document.getElementById('delete-user-btn').addEventListener('click', () => deleteUser(userId));

            
        });
}


    // ===================== ПАНЕЛЬ АДМИНА =====================
// Функция для удаления пользователя

    function showAdminPage() {
        authForm.innerHTML = `
            <h2>Управление</h2>
            <button id="register-btn" ${buttonStyle}>Зарегистрировать нового пользователя</button>
            <button id="list-users-btn" ${buttonStyle}>Посмотреть список пользователей</button>
            <button id="add-group-btn" ${buttonStyle}>Добавить группу</button>
            <button id="add-discipline-btn" ${buttonStyle}>Добавить дисциплину</button>
           <button id="upload-excel-btn" ${buttonStyle}>Загрузить данные через Excel</button>
            <button id="logout-btn" ${buttonStyle}>Выйти</button>
        `;

        document.getElementById('register-btn').addEventListener('click', showRegisterForm);
        document.getElementById('list-users-btn').addEventListener('click', showUsersList);
        document.getElementById('add-group-btn').addEventListener('click', showAddGroupForm);
        document.getElementById('add-discipline-btn').addEventListener('click', showAddDisciplineForm);
        document.getElementById('upload-excel-btn').addEventListener('click', showUploadForm);
        document.getElementById('logout-btn').addEventListener('click', () => {
            localStorage.clear();
            showLoginForm();
        });
        eval(buttonHoverScript);
    }

    // ===================== ВХОД =====================

    function showLoginForm() {
        authForm.innerHTML = `
            <h2>Войти в систему</h2>
            <form id="login-form">
                <input type="text" id="login-full-name" placeholder="Введите ФИО" required>
                <input type="password" id="login-password" placeholder="Введите пароль" required>
                <button type="submit">Войти</button>
            </form>
        `;
        attachEventListeners();
    }
function showUploadForm() {
    authForm.innerHTML = `
        <h2>Загрузка Excel файла</h2>
        <form id="upload-form" enctype="multipart/form-data">
            <label for="file">Выберите файл Excel:</label>
            <input type="file" name="file" id="file" accept=".xlsx" required>
            <button type="submit">Загрузить</button>
        </form>
        <br>
      <button id="back-to-admin" class="styled-button">Назад</button>
    `;
    const backButton = document.getElementById('back-to-admin');
    if (backButton) {
        backButton.addEventListener('click', showAdminPage); // Добавление обработчика для кнопки "Назад"
    }
    document.getElementById('upload-form').addEventListener('submit', handleFileUpload);
    document.getElementById('back-to-admin').addEventListener('click', showAdminPage);
}
    function handleLoginSubmit(e) {
        e.preventDefault();
        const full_name = document.getElementById('login-full-name').value;
        const password = document.getElementById('login-password').value;

        fetch('http://127.0.0.1:5000/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ full_name, password })
        })
        .then(response => response.json())
        .then(data => {
            if (data.message === 'Invalid credentials') {
                alert('Неверные данные для входа');
            } else {
                localStorage.setItem('user_id', data.user_id);
                localStorage.setItem('role', data.role);
                showHomePage();
            }
        });
    }

    function showHomePage() {
        const role = localStorage.getItem('role');
        if (role === 'student') showStudentPage();
        else if (role === 'teacher') showTeacherPage();
        else if (role === 'admin') showAdminPage();
    }

    function showStudentPage() {
        const userId = localStorage.getItem('user_id');
        fetch(`http://127.0.0.1:5000/student_disciplines?user_id=${userId}`)
            .then(response => response.json())
            .then(disciplines => {
                let html = '<h2>Доступные дисциплины</h2>';
                disciplines.forEach(d => {
                    html += `<div><button data-id="${d.id}" class="discipline-btn">${d.name}</button></div>`;
                });
                html += `<br><button id="logout-btn">Выйти</button>`;
                authForm.innerHTML = html;
    
                // Добавляем обработчики на кнопки дисциплин
                document.querySelectorAll('.discipline-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const disciplineId = btn.dataset.id;
                        showStudentAttendance(disciplineId);
                    });
                });
    
                document.getElementById('logout-btn').addEventListener('click', () => {
                    localStorage.clear();
                    showLoginForm();
                });
            });
    }
    
    
   function showStudentAttendance(disciplineId) {
        const userId = localStorage.getItem('user_id');

        fetch(`http://127.0.0.1:5000/student_attendance?user_id=${userId}&discipline_id=${disciplineId}`)
            .then(res => res.json())
            .then(records => {
                let html = `
                    <h2>Моя посещаемость</h2>
                    <label>Фильтр по дате: <input type="date" id="filter-date"></label>
                    <button id="export-pdf" style="margin: 10px 10px 10px 0;">Скачать PDF</button>
                    <button id="export-excel" style="margin: 10px 0;">Скачать Excel</button>
                    <div id="attendance-list" class="attendance-card-container">
                `;

                if (records.length === 0) {
                    html += `<p>Нет данных по посещаемости.</p>`;
                } else {
                    records.forEach(r => {
                        html += `
                            <div class="attendance-card ${r.status === 'present' ? 'present' : 'absent'}" data-date="${r.date}">
                                <p><strong>Дата:</strong> ${r.date}</p>
                                <p><strong>Статус:</strong> ${r.status === 'present' ? '✅ Присутствовал' : '❌ Отсутствовал'}</p>
                            </div>
                        `;
                    });
                }

                html += `
                    </div>
                    <br><button id="back-to-student" style="margin-top: 20px;">Назад</button>
                `;

                authForm.innerHTML = html;

                document.getElementById('filter-date').addEventListener('input', e => {
                    const date = e.target.value;
                    document.querySelectorAll('.attendance-card').forEach(card => {
                        card.style.display = !date || card.dataset.date === date ? 'block' : 'none';
                    });
                });

                document.getElementById('export-pdf').addEventListener('click', () => {
                    const content = document.getElementById('attendance-list').innerHTML;
                    const printWindow = window.open('', '', 'width=800,height=600');
                    printWindow.document.write('<html><head><title>PDF</title></head><body>');
                    printWindow.document.write(content);
                    printWindow.document.write('</body></html>');
                    printWindow.document.close();
                    printWindow.print();
                });

                document.getElementById('export-excel').addEventListener('click', () => {
                    let csvContent = '\uFEFFДата,Статус\n';  // BOM + заголовки
                    records.forEach(r => {
                        const statusText = r.status === 'present' ? 'Присутствовал' : 'Отсутствовал';
                        csvContent += `"${r.date}","${statusText}"\n`;
                    });
                
                    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'student_attendance.csv';
                    document.body.appendChild(a);
                    a.click();
 
                    URL.revokeObjectURL(url);
                });

                document.getElementById('back-to-student').addEventListener('click', showStudentPage);
            });
    }
    
    

    function showTeacherPage() {
        const userId = localStorage.getItem('user_id');
    
        fetch(`http://127.0.0.1:5000/teacher_groups?user_id=${userId}`)
            .then(res => res.json())
            .then(groups => {
                let html = '<h2>Ваши группы</h2>';
                groups.forEach(group => {
                    html += `<button class="group-btn" data-group-id="${group.id}" data-group-name="${group.name}">${group.name}</button>`;
                });
                html += `<br><button id="logout-btn" ${buttonStyle}>Выйти</button>`;
                authForm.innerHTML = html;
    
                document.querySelectorAll('.group-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const groupId = btn.dataset.groupId;
                        const groupName = btn.dataset.groupName;
                        showAttendanceForm(groupId, groupName);
                    });
                });
    
                document.getElementById('logout-btn').addEventListener('click', () => {
                    localStorage.clear();
                    showLoginForm();
                });
    
                eval(buttonHoverScript);
            });
    }
    
    

    function showAttendanceForm(groupId, groupName) {
        const userId = localStorage.getItem('user_id');
    
        Promise.all([
            fetch(`http://127.0.0.1:5000/group_students?group_id=${groupId}`).then(res => res.json()),
            fetch(`http://127.0.0.1:5000/teacher_disciplines?user_id=${userId}`).then(res => res.json())
        ]).then(([students, disciplines]) => {
            let html = `<h2>Посещаемость для группы "${groupName}"</h2>`;
    
            html += `<label>Дисциплина:
                    <select id="discipline-select">
                        ${disciplines.map(d => `<option value="${d.id}">${d.name}</option>`).join('')}
                    </select>
                </label>
                <label>Дата:
                    <input type="date" id="attendance-date" required>
                </label>
                <table style="width:100%;margin-top:10px">
                    <thead>
                        <tr><th>ФИО</th><th>Статус</th></tr>
                    </thead>
                    <tbody>
                        ${students.map(s => `
                            <tr>
                                <td>${s.full_name}</td>
                                <td>
                                    <select data-student-id="${s.id}" class="attendance-status">
                                        <option value="present">Присутствовал</option>
                                        <option value="absent">Отсутствовал</option>
                                    </select>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                <br>
                <button id="save-attendance" ${buttonStyle}>Сохранить</button>
                <button id="view-attendance" ${buttonStyle}>Посмотреть журнал</button>
                <button id="download-report" ${buttonStyle}>Скачать отчёт</button>
                <button id="back-to-teacher" ${buttonStyle}>Назад</button>`;
    
            authForm.innerHTML = html;

            document.getElementById('download-report').addEventListener('click', () => {
                const disciplineId = document.getElementById('discipline-select').value;
            
                fetch(`http://127.0.0.1:5000/attendance/report?group_id=${groupId}&discipline_id=${disciplineId}`)
                    .then(response => response.blob())
                    .then(blob => {
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `Отчет_группа_${groupName}.xlsx`;
                        document.body.appendChild(a);
                        a.click();
                        a.remove();
                        URL.revokeObjectURL(url);
                    });
            });
            document.getElementById('save-attendance').addEventListener('click', () => {
                const date = document.getElementById('attendance-date').value;
                const disciplineId = document.getElementById('discipline-select').value;
            
                if (!date || !disciplineId) {
                    alert('Пожалуйста, выберите дату и дисциплину');
                    return;
                }
            
                const attendance = Array.from(document.querySelectorAll('.attendance-status')).map(select => ({
                    student_id: parseInt(select.dataset.studentId),
                    status: select.value,
                    date,
                    discipline_id: parseInt(disciplineId)
                }));
            
                const payload = {
                    role: localStorage.getItem('role') || 'teacher',
                    attendance
                };
            
                fetch('http://127.0.0.1:5000/attendance/add_bulk', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                })
                .then(res => res.json())
                .then(data => {
                    alert(data.message || 'Посещаемость добавлена');
                    showTeacherPage();
                })
                .catch(err => alert('Ошибка при сохранении: ' + err.message));
            });
            
            

            
    
            document.getElementById('view-attendance').addEventListener('click', () => {
                const disciplineId = document.getElementById('discipline-select').value;
    
                fetch(`http://127.0.0.1:5000/attendance/view?group_id=${groupId}&discipline_id=${disciplineId}`)
                    .then(res => res.json())
                    .then(records => {
                        let html = `<h2>Журнал посещаемости: ${groupName}</h2>`;
                        html += `<table style="width:100%;margin-top:10px"><thead><tr><th>ФИО</th><th>Дата</th><th>Статус</th></tr></thead><tbody>`;
                        records.forEach(r => {
                            html += `<tr><td>${r.full_name}</td><td>${r.date}</td><td>${r.status === 'present' ? 'Присутствовал' : 'Отсутствовал'}</td></tr>`;
                        });
                        html += '</tbody></table>';
                        html += `<br><button id="back-to-form" ${buttonStyle}>Назад</button>`;
                        authForm.innerHTML = html;
                        document.getElementById('back-to-form').addEventListener('click', () => showAttendanceForm(groupId, groupName));
                    });
            });

          
            document.getElementById('back-to-teacher').addEventListener('click', showTeacherPage);
        });
    }
    
    

    function attachEventListeners() {
        const loginForm = document.getElementById('login-form');
        if (loginForm) loginForm.addEventListener('submit', handleLoginSubmit);
    }

    if (localStorage.getItem('user_id')) {
        showHomePage();
    } else {
        showLoginForm();
    }
});
