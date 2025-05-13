from flask import Flask, jsonify, request
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
import random
import string
import os
from sqlalchemy import inspect
from flask import request, jsonify
from flask import make_response
import pandas as pd
from flask import send_file
from io import BytesIO

# Инициализация приложения
app = Flask(__name__)

# Конфигурация для SQLAlchemy
app.config['SQLALCHEMY_DATABASE_URI'] = (
    f"mysql+mysqldb://{os.getenv('MYSQLUSER')}:{os.getenv('MYSQLPASSWORD')}@"
    f"{os.getenv('MYSQLHOST')}:{os.getenv('MYSQLPORT')}/{os.getenv('MYSQLDATABASE')}"
)
app.config['UPLOAD_FOLDER'] = 'uploads'  # Папка для загрузки файлов

# Инициализация SQLAlchemy
db = SQLAlchemy(app)  # Привязываем к приложению сразу

# Разрешаем CORS для нужных путей
CORS(app)
CORS(app, resources={r"/attendance/*": {"origins": "http://localhost:3000"}})
CORS(app, resources={r"/upload_excel": {"origins": "http://localhost:3000"}})

# Проверка существования папки для загрузки
if not os.path.exists(app.config['UPLOAD_FOLDER']):
    os.makedirs(app.config['UPLOAD_FOLDER'])

# ==============================
# МОДЕЛИ
# ==============================

class Group(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    students = db.relationship('User', backref='group', lazy=True)
    disciplines = db.relationship('Discipline', backref='group', lazy=True)

class Discipline(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    group_id = db.Column(db.Integer, db.ForeignKey('group.id'), nullable=False)
    attendance = db.relationship('Attendance', backref='discipline', lazy=True)

class User(db.Model):
    __tablename__ = 'user'
    id = db.Column(db.Integer, primary_key=True)
    full_name = db.Column(db.String(100), nullable=False)
    role = db.Column(db.String(50), nullable=False)
    group_id = db.Column(db.Integer, db.ForeignKey('group.id'), nullable=False)
    password = db.Column(db.String(100), nullable=False)

class Attendance(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    status = db.Column(db.String(10), nullable=False)
    date = db.Column(db.String(50), nullable=False)
    discipline_id = db.Column(db.Integer, db.ForeignKey('discipline.id'), nullable=False)
    student_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)

class UserDiscipline(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    discipline_id = db.Column(db.Integer, db.ForeignKey('discipline.id'), nullable=False)

    discipline = db.relationship('Discipline') 

# ==============================
# СОЗДАНИЕ БАЗЫ И АДМИНА
# ==============================

def create_tables():
    inspector = inspect(db.engine)
    if not inspector.has_table('user'):
        db.create_all()

        # Создание группы
        admin_group = Group(id=1, name='Админ-группа')
        db.session.add(admin_group)
        db.session.commit()

        # Создание пользователя admin
        admin = User(
            full_name='admin',
            role='admin',
            password='admin',
            group_id=1
        )
        db.session.add(admin)
        db.session.commit()
        print("🛠️ Администратор создан: ФИО='Администратор', пароль='admin'")

# ==============================
# РОУТЫ
# ==============================

@app.route('/register_user', methods=['POST'])
def register_user():
    data = request.get_json()
    full_name = data['full_name']
    role = data['role']
    password = data['password']
    group_id = data.get('group_id')
    discipline_ids = data.get('discipline_ids', [])

    if role not in ['student', 'teacher']:
        return jsonify({'message': 'Invalid role'}), 400

    if role == 'student' and not group_id:
        return jsonify({'message': 'Student must have a group'}), 400

    user = User(
        full_name=full_name,
        role=role,
        group_id=group_id if role == 'student' else 1,
        password=password
    )
    db.session.add(user)
    db.session.commit()

    for d_id in discipline_ids:
        db.session.add(UserDiscipline(user_id=user.id, discipline_id=d_id))
    db.session.commit()

    return jsonify({'message': 'User registered successfully'})



@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    full_name = data['full_name']
    password = data['password']
    user = User.query.filter_by(full_name=full_name, password=password).first()
    if user:
        return jsonify({
            'message': f'Welcome, {user.full_name}!',
            'role': user.role,
            'user_id': user.id
        })
    return jsonify({'message': 'Invalid credentials'}), 401

@app.route('/users', methods=['GET'])
def get_users():
    users = User.query.all()
    return jsonify([
        {
         'id': user.id,
        'full_name': user.full_name,
        'role': user.role,
        'group_id': user.group_id,
        'password': user.password
        } for user in users
    ])

@app.route('/student_disciplines', methods=['GET'])
def get_student_disciplines():
    user_id = request.args.get('user_id')
    student = User.query.get(user_id)
    if student and student.role == 'student':
        disciplines = Discipline.query.filter_by(group_id=student.group_id).all()
        return jsonify([{'id': d.id, 'name': d.name} for d in disciplines])
    return jsonify({'message': 'Student not found or not authorized'}), 404

@app.route('/teacher_disciplines', methods=['GET'])
def get_teacher_disciplines():
    user_id = request.args.get('user_id')
    user_discipline_ids = db.session.query(UserDiscipline.discipline_id).filter_by(user_id=user_id).all()
    discipline_ids = [id for (id,) in user_discipline_ids]

    disciplines = Discipline.query.filter(Discipline.id.in_(discipline_ids)).all()
    return jsonify([{'id': d.id, 'name': d.name} for d in disciplines])

@app.route('/attendance/add_bulk', methods=['POST'])
def add_bulk_attendance():
    data = request.get_json()
    role = data.get('role')

    if role not in ['teacher', 'admin']:
        return jsonify({'message': 'You are not authorized to add attendance'}), 403

    for item in data['attendance']:
        attendance = Attendance(
            student_id=item['student_id'],
            date=item['date'],
            status=item['status'],
            discipline_id=item['discipline_id']
        )
        db.session.add(attendance)
    db.session.commit()

    return jsonify({'message': 'Посещаемость успешно добавлена'})

@app.route('/groups', methods=['GET'])
def get_groups():
    groups = Group.query.all()
    return jsonify([{'id': g.id, 'name': g.name} for g in groups])

@app.route('/disciplines', methods=['GET'])
def get_disciplines():
    disciplines = Discipline.query.all()
    return jsonify([{'id': d.id, 'name': d.name} for d in disciplines])

@app.route('/create_group', methods=['POST'])
def create_group():
    data = request.get_json()
    group = Group(name=data['name'])
    db.session.add(group)
    db.session.commit()
    # студентов пока не прикрепляем, если нужно — добавим позже
    return jsonify({'message': 'Group created'})


@app.route('/create_discipline', methods=['POST'])
def create_discipline():
    data = request.get_json()
    print('📥 Получены данные от клиента:', data)

    name = data.get('name')
    group_ids = data.get('group_ids', [])

    # Проверим на отсутствие важных данных
    if not name or not group_ids:
        return jsonify({'message': 'Название или группы не указаны'}), 400

    print('👉 Данные корректны:', name, group_ids)

    for group_id in group_ids:
        print(f'➡ Добавляется дисциплина "{name}" для группы {group_id}')
        discipline = Discipline(name=name, group_id=group_id)
        db.session.add(discipline)

    try:
        db.session.commit()
        print('✅ Дисциплины успешно сохранены в БД')
        return jsonify({'message': 'Дисциплины добавлены'})
    except Exception as e:
        db.session.rollback()
        print('❌ Ошибка при сохранении дисциплины:', str(e))
        return jsonify({'message': 'Ошибка при сохранении дисциплины', 'error': str(e)}), 500



@app.route('/teacher_groups', methods=['GET'])
def get_teacher_groups():
    user_id = request.args.get('user_id')
    disciplines = UserDiscipline.query.filter_by(user_id=user_id).all()
    group_ids = set(d.discipline.group_id for d in disciplines if d.discipline)
    groups = Group.query.filter(Group.id.in_(group_ids)).all()
    return jsonify([{'id': g.id, 'name': g.name} for g in groups])


@app.route('/group_students', methods=['GET'])
def group_students():
    group_id = request.args.get('group_id')
    students = User.query.filter_by(group_id=group_id, role='student').all()
    return jsonify([{'id': s.id, 'full_name': s.full_name} for s in students])

@app.route('/attendance/view', methods=['GET'])
def view_attendance():
    group_id = request.args.get('group_id', type=int)
    discipline_id = request.args.get('discipline_id', type=int)

    students = User.query.filter_by(group_id=group_id).all()
    result = []

    for student in students:
        records = Attendance.query.filter_by(student_id=student.id, discipline_id=discipline_id).all()
        for r in records:
            result.append({
                'full_name': student.full_name,
                'date': r.date,
                'status': r.status
            })

    return jsonify(result)

@app.route('/student_attendance', methods=['GET'])
def student_attendance():
    user_id = request.args.get('user_id', type=int)
    discipline_id = request.args.get('discipline_id', type=int)

    records = Attendance.query.filter_by(student_id=user_id, discipline_id=discipline_id).all()

    result = [
        {
            'date': r.date,
            'status': r.status
        } for r in records
    ]

    return jsonify(result)


@app.route('/attendance/report', methods=['GET'])
def attendance_report():
    group_id = request.args.get('group_id', type=int)
    discipline_id = request.args.get('discipline_id', type=int)

    students = User.query.filter_by(group_id=group_id, role='student').all()
    student_ids = [s.id for s in students]
    attendance_records = Attendance.query.filter(Attendance.student_id.in_(student_ids),
                                                 Attendance.discipline_id == discipline_id).all()

    # Уникальные даты
    dates = sorted(set(r.date for r in attendance_records))

    # Сбор данных
    report_data = []
    for student in students:
        row = {'ФИО': student.full_name}
        for date in dates:
            record = next((r for r in attendance_records if r.student_id == student.id and r.date == date), None)
            row[date] = 'Присуствовал' if record and record.status == 'present' else 'Отсуствовал'
        report_data.append(row)

    df = pd.DataFrame(report_data)
    excel_path = 'report.xlsx'
    df.to_excel(excel_path, index=False)

    return send_file(excel_path, as_attachment=True)

@app.route('/attendance/report', methods=['GET'])
def get_attendance_report():
    try:
        group_id = request.args.get('group_id')
        discipline_id = request.args.get('discipline_id')

        # Отладка: печать данных, полученных из запроса
        print(f"Запрос на отчёт: group_id={group_id}, discipline_id={discipline_id}")
        
        # Например, загружаем отчет из базы данных
        # data = generate_report(group_id, discipline_id)

        return jsonify({'message': 'Отчёт успешно сформирован'})

    except Exception as e:
        # Печатаем ошибку в консоли
        print(f"Ошибка при формировании отчёта: {str(e)}")
        
        # Возвращаем ошибку 500, если что-то пошло не так
        return jsonify({'message': 'Ошибка при формировании отчёта', 'details': str(e)}), 500
    

import random
import string

# Функция для генерации случайного пароля
def generate_random_password(length=12):
    characters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'  # Символы для пароля
    password = ''.join(random.choice(characters) for i in range(length))
    return password


@app.route('/upload_excel', methods=['POST'])
def upload_excel():
    try:
        # Получаем файл из запроса
        file = request.files['file']
        
        # Логируем имя полученного файла
        print(f"Получен файл: {file.filename}")
        
        # Проверка формата файла
        if not file.filename.endswith('.xlsx'):
            return jsonify({"message": "Неверный формат файла. Ожидается .xlsx"}), 400

        # Сохранение файла на сервере
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], file.filename)
        file.save(file_path)
        print(f"Файл сохранен по пути: {file_path}")

        # Чтение данных из Excel
        df_users = pd.read_excel(file_path, sheet_name='Users')
        df_groups = pd.read_excel(file_path, sheet_name='Groups')
        df_disciplines = pd.read_excel(file_path, sheet_name='Disciplines')

        # Загружаем все группы и дисциплины из базы данных
        groups_in_db = {group.name.lower(): group.id for group in Group.query.all()}  # Сохраняем группы в нижнем регистре
        disciplines_in_db = {discipline.name.lower(): discipline.id for discipline in Discipline.query.all()}  # Сохраняем дисциплины в нижнем регистре

        # Добавление групп в базу данных (если они не существуют)
        for index, row in df_groups.iterrows():
            group_name = str(row['group_name']).strip().lower()  # Приводим к строке и удаляем пробелы
            if group_name not in groups_in_db:  # Проверяем, существует ли группа в базе
                group = Group(name=row['group_name'])
                db.session.add(group)
                db.session.commit()
                groups_in_db[group_name] = group.id  # Обновляем ID группы

        # Добавление дисциплин в базу данных (если они не существуют)
        for index, row in df_disciplines.iterrows():
            discipline_name = str(row['discipline_name']).strip().lower()  # Приводим к строке и удаляем пробелы
            if discipline_name not in disciplines_in_db:  # Проверяем, существует ли дисциплина в базе
                group_id = groups_in_db.get('группа 1')  # Пример группы
                discipline = Discipline(name=row['discipline_name'], group_id=group_id)
                db.session.add(discipline)
                db.session.commit()
                disciplines_in_db[discipline_name] = discipline.id  # Обновляем ID дисциплины

        # Добавление пользователей в базу данных (если они не существуют)
        for index, row in df_users.iterrows():
            full_name = str(row['full_name']).strip()  # Убираем лишние пробелы
            role = row['role']
            group_name = str(row['group_name']).strip().lower()  # Приводим к строке и удаляем пробелы
            discipline_names = str(row['discipline_names']).split(',')  # Дисциплины через запятую

            # Ищем группу по имени, приводим к нижнему регистру
            group_id = groups_in_db.get(group_name)
            if not group_id:
                print(f"Ошибка: группа '{group_name}' не найдена в базе данных!")
                continue  # Пропускаем, если группа не найдена

            # Проверяем, существует ли пользователь с таким именем
            existing_user = User.query.filter_by(full_name=full_name).first()
            if existing_user:
                print(f"Пользователь '{full_name}' уже существует, пропускаем добавление.")
                continue  # Пропускаем добавление, если пользователь уже существует

            # Генерация случайного пароля
            random_password = generate_random_password()

            # Создание пользователя с сгенерированным паролем
            user = User(full_name=full_name, role=role, group_id=group_id, password=random_password)
            db.session.add(user)
            db.session.commit()

            # Добавление дисциплин для пользователя (если дисциплина существует в базе)
            for discipline_name in discipline_names:
                discipline_id = disciplines_in_db.get(discipline_name.strip().lower())  # Приводим к нижнему регистру
                if discipline_id:
                    user_discipline = UserDiscipline(user_id=user.id, discipline_id=discipline_id)
                    db.session.add(user_discipline)

        db.session.commit()  # Сохраняем все изменения в базе данных

        return jsonify({"message": "Файл успешно загружен и данные добавлены!"}), 200

    except Exception as e:
        print(f"Ошибка при обработке файла: {e}")
        return jsonify({"message": "Ошибка при загрузке файла", "error": str(e)}), 500


# ==============================
# ЗАПУСК
# ==============================


if __name__ == '__main__':
    with app.app_context():
        create_tables()
    app.run(debug=True)