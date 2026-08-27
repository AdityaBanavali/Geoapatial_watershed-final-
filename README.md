```markdown
# 🌍 Watershed Atlas Pro (Field Intelligence)

A full-stack geospatial web application designed for automated multi-spectral remote sensing analysis of watersheds using Google Earth Engine (GEE), Sentinel-2 satellite imagery, and dynamic AI-driven environmental recommendations.

---

## 🏗️ Architecture & Tech Stack

*   **Frontend**: React (Vite-based SPA), Leaflet for interactive mapping, hosted on **Vercel**.
*   **Backend**: Python FastAPI service, Google Earth Engine Python API (`earthengine-api`), hosted on **Railway** via Docker.
*   **Core Capabilities**:
    *   Interactive polygon drawing and geo-spatial geometry validation.
    *   Real-time multi-spectral index calculation (NDVI, NDWI, MNDWI, EVI) from Sentinel-2 surface reflectance data.
    *   Historical 6-month monthly time-series trend tracking.
    *   Automated, context-aware watershed management recommendations (water harvesting, soil conservation, and vegetation restoration).

---

## ⚙️ Environment Configuration

To run and deploy this application successfully, proper environment variables must be configured on both frontend and backend deployment platforms.

### 1. Backend (`main.py` / Railway)
Add the following environment variables in your **Railway Project Settings > Variables**:
*   `PORT`: Automatically injected by Railway (listened to dynamically by Uvicorn).
*   `EE_PROJECT_ID`: Your Google Cloud Project ID with Earth Engine enabled.
*   `EE_SERVICE_ACCOUNT_JSON`: The full contents of your Google Cloud Service Account JSON key file, flattened into a **single-line string** without line breaks.

### 2. Frontend (`Vite` / Vercel)
Add the following environment variable in your **Vercel Project Settings > Environment Variables**:
*   `VITE_API_URL`: The public production URL of your Railway backend service (e.g., `https://your-backend-service.up.railway.app`). *Note: Do not include a trailing slash.*

---

## 🚀 Local Development Setup

Follow these steps to run the application locally on your machine.

### Prerequisites
*   Python 3.11+
*   Node.js & npm
*   A Google Earth Engine account and authenticated local CLI (`earthengine authenticate`) or Service Account credentials.

### 1. Clone the Repository
```bash
git clone [https://github.com/your-username/your-repo-name.git](https://github.com/your-username/your-repo-name.git)
cd your-repo-name

```

### 2. Run the Backend

```bash
# Create and activate a virtual environment
python -m venv venv
source venv/bin/activate  # On Windows use: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set up local environment variables in a .env file
# EE_PROJECT_ID=your-gcp-project-id

# Start the FastAPI server
python main.py

```

The backend API will run locally at `http://localhost:8080`.

### 3. Run the Frontend

```bash
cd watershed-frontend

# Install dependencies
npm install

# Start the Vite development server
npm run dev

```

The frontend application will run locally at `http://localhost:5173`.

---

## 🚢 Deployment Workflow

* **Frontend (Vercel)**: Automatically links to your GitHub repository `main` branch. Any push to `main` triggers a production build using Vite.
* **Backend (Railway)**: Configured via `Dockerfile` and `requirements.txt`. Railway builds the container, detects the dynamic runtime port, and handles high-availability uptime for processing Google Earth Engine requests.

---

## 📄 License

This project is open-source and available under the [MIT License](./LICENSE).
```

```
