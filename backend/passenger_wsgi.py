import sys
import os

# Путь к вашему проекту
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app import app as application