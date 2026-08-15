\# 🚗 Park0 — Smart Roadside Parking System



\*\*Park0\*\* is an AI-powered smart roadside parking management system designed to help users find available parking spaces while providing shopkeepers with real-time visibility into parking activity.



The system combines \*\*computer vision, real-time vehicle detection, a FastAPI backend, MongoDB, and a React-based frontend\*\* to monitor roadside parking and dynamically calculate parking availability.



\---



\## 🎯 Problem Statement



Finding available roadside parking near busy commercial areas is often difficult. Drivers spend unnecessary time searching for parking, while businesses have limited visibility into parking availability and vehicle activity.



\*\*Park0 addresses this problem by using live camera feeds and AI-based vehicle detection to provide real-time parking information.\*\*



\---



\## ✨ Key Features



\* 🎥 \*\*Live Camera Monitoring\*\* — Processes roadside camera feeds for real-time monitoring.

\* 🚘 \*\*AI Vehicle Detection\*\* — Detects vehicles using YOLOv8-based computer vision.

\* 🚗 \*\*Vehicle Classification\*\* — Identifies vehicle types such as cars and bikes.

\* 🅿️ \*\*Real-Time Parking Calculation\*\* — Calculates available and occupied parking spaces dynamically.

\* 📊 \*\*Shopkeeper Dashboard\*\* — Provides businesses with parking and vehicle activity information.

\* 👤 \*\*User Interface\*\* — Allows users to view parking availability and interact with the system.

\* 🔐 \*\*Authentication\*\* — Supports user authentication and backend access control.

\* 💾 \*\*MongoDB Integration\*\* — Stores application, vehicle, and parking-related data.

\* ⚡ \*\*Real-Time Communication\*\* — Uses WebSocket-based communication for live updates.

\* 🔎 \*\*Tracking \& ANPR Foundation\*\* — Backend architecture prepared for vehicle tracking and automatic number plate recognition.



\---



\## 🧠 How Park0 Works



```text

&#x20;               ┌─────────────────────┐

&#x20;               │    Live Camera      │

&#x20;               └──────────┬──────────┘

&#x20;                          │

&#x20;                          ▼

&#x20;               ┌─────────────────────┐

&#x20;               │    YOLOv8 + OpenCV  │

&#x20;               │  Vehicle Detection  │

&#x20;               └──────────┬──────────┘

&#x20;                          │

&#x20;                          ▼

&#x20;               ┌─────────────────────┐

&#x20;               │ Vehicle Classification│

&#x20;               │     Car / Bike      │

&#x20;               └──────────┬──────────┘

&#x20;                          │

&#x20;                          ▼

&#x20;               ┌─────────────────────┐

&#x20;               │ Parking Calculation │

&#x20;               └──────────┬──────────┘

&#x20;                          │

&#x20;                          ▼

&#x20;               ┌─────────────────────┐

&#x20;               │    FastAPI Backend  │

&#x20;               └──────────┬──────────┘

&#x20;                          │

&#x20;                 ┌────────┴────────┐

&#x20;                 ▼                 ▼

&#x20;         ┌──────────────┐   ┌───────────────┐

&#x20;         │   MongoDB    │   │ React Frontend│

&#x20;         └──────────────┘   └───────┬───────┘

&#x20;                                    │

&#x20;                             ┌──────▼──────┐

&#x20;                             │    Users    │

&#x20;                             │  \& Shops    │

&#x20;                             └─────────────┘

```



\---



\## 🛠️ Tech Stack



\### Frontend



\* \*\*React.js\*\*

\* \*\*TypeScript\*\*

\* \*\*HTML5\*\*

\* \*\*CSS3\*\*

\* \*\*Vite\*\*



\### Backend



\* \*\*Python\*\*

\* \*\*FastAPI\*\*

\* \*\*REST APIs\*\*

\* \*\*WebSockets\*\*



\### AI \& Computer Vision



\* \*\*YOLOv8\*\*

\* \*\*OpenCV\*\*

\* \*\*Computer Vision\*\*

\* Vehicle Detection \& Classification



\### Database



\* \*\*MongoDB\*\*

\* \*\*PyMongo\*\*

\* \*\*Motor\*\* for asynchronous MongoDB operations



\### Tools



\* \*\*Git\*\*

\* \*\*GitHub\*\*

\* \*\*VS Code\*\*



\---



\## 📂 Project Structure



```text

Park0/

│

├── backend/

│   ├── anpr.py

│   ├── auth.py

│   ├── database.py

│   ├── detector.py

│   ├── main.py

│   ├── models.py

│   ├── schemas.py

│   ├── requirements.txt

│   └── ...

│

├── frontend/

│   ├── public/

│   ├── src/

│   │   ├── assets/

│   │   ├── pages/

│   │   │   ├── AdminPortal.tsx

│   │   │   ├── FindParking.tsx

│   │   │   ├── Home.tsx

│   │   │   ├── MyBookings.tsx

│   │   │   └── ShopPortal.tsx

│   │   ├── App.tsx

│   │   ├── App.css

│   │   └── main.tsx

│   ├── package.json

│   └── vite.config.ts

│

├── test\_ws.py

├── verify\_services.py

├── yolov8n.pt

├── parko0.db

└── README.md

```



\---



\## ⚙️ Setup \& Installation



\### Prerequisites



Make sure you have installed:



\* Python 3.x

\* Node.js \& npm

\* MongoDB

\* Git



\### 1. Clone the Repository



```bash

git clone https://github.com/ChinmayT098/Park0-Smart-Roadside-Parking-System.git

cd Park0-Smart-Roadside-Parking-System

```



\### 2. Backend Setup



```bash

cd backend

python -m venv venv

```



Activate the virtual environment on Windows:



```powershell

venv\\Scripts\\activate

```



Install dependencies:



```bash

pip install -r requirements.txt

```



\### 3. Configure Environment Variables



Create a `.env` file inside the backend directory:



```env

MONGODB\_URL=mongodb://localhost:27017

DB\_NAME=parko\_db

```



For production, use your MongoDB deployment connection string instead of the local MongoDB URL.



\### 4. Start the Backend



From the `backend` directory:



```bash

uvicorn main:app --reload

```



FastAPI documentation:



```text

http://127.0.0.1:8000/docs

```



\### 5. Start the Frontend



Open another terminal:



```bash

cd frontend

npm install

npm run dev

```



Open the local URL provided by Vite.



\---



\## 📊 Current Implementation



\### Completed



\* \[x] React-based user interface

\* \[x] User parking interface

\* \[x] Shopkeeper dashboard

\* \[x] FastAPI backend

\* \[x] MongoDB database integration

\* \[x] Authentication foundation

\* \[x] Live camera feed processing

\* \[x] YOLOv8 vehicle detection

\* \[x] Car/bike classification

\* \[x] Real-time parking-space calculation

\* \[x] WebSocket communication

\* \[x] Vehicle detection data processing

\* \[x] Foundation for vehicle tracking and ANPR



\### Future Enhancements



\* \[ ] Multi-object tracking with persistent vehicle IDs

\* \[ ] Automatic Number Plate Recognition (ANPR)

\* \[ ] Advanced parking-slot mapping

\* \[ ] Historical parking analytics

\* \[ ] Multi-camera support

\* \[ ] Cloud deployment

\* \[ ] Mobile application

\* \[ ] Parking availability notifications



\---



\## 🚀 Future Vision



Park0 aims to evolve into a scalable smart parking platform capable of monitoring multiple roadside locations, tracking vehicle movement, identifying vehicles through ANPR, and providing real-time parking intelligence to both users and businesses.



\---



\## 👨‍💻 Developer



\*\*Chinmay Talawar\*\*



Computer Science Engineering



\*\*Interests:\*\* Cloud Computing • DevOps • AI • Computer Vision



\---



\## 📌 Project Summary



\*\*Park0 — Smart Roadside Parking System\*\*



> An AI-powered roadside parking solution combining \*\*React, FastAPI, MongoDB, YOLOv8, OpenCV, and real-time communication\*\* to provide intelligent parking monitoring and availability information.



