# Dockerfile
FROM python:3.10

WORKDIR /app

COPY backend/ /app/
COPY frontend /app/frontend
RUN pip install -r requirements.txt

CMD ["gunicorn", "--bind", "0.0.0.0:5000", "app:app"]