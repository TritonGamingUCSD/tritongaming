# 🎮 Triton Gaming Website

The **official website** for [Triton Gaming](https://tritongaming.onrender.com/)

---

## 🚀 Prerequisites

Before getting started, ensure the following:

- **Node.js** v22 or higher  
- MongoDB Atlas account or self-hosted MongoDB instance

---

## 🛠 Tech Stack

- **Frontend:** Vite ⚡ + React ⚛️  
- **Backend:** Node.js + Express.js + MongoDB 🍃

---

## 📦 Local Development Setup

### 1️⃣ Clone the Repository

```bash
git clone https://github.com/TritonGamingUCSD/tritongaming-website.git
cd tritongaming-website
```

### 2️⃣ Configure Environment Variables

Create a `.env` file in the root directory using `.env.example` as a template:

```env
PORT=80                    # Website port
ATLAS_URI=                 # MongoDB connection string
DB_NAME=website_db         # Database name
```

### 3️⃣ Install Dependencies

```bash
npm install
```

---

## 💻 Frontend Development

1. Start the development server:

   ```bash
   npm run dev
   ```

2. Open your browser and go to:  
   👉 [http://localhost:5173](http://localhost:5173)

---

## 🧪 Backend Development

1. Build the frontend for integration:

   ```bash
   npm run build
   ```

2. Start the backend server:

   ```bash
   npm run dev
   ```

3. Open your browser and go to:  
   👉 [http://localhost](http://localhost)

---

## Common Q&A
1. MongoDB connection failed:
> Check network access, see if the IP address is added

2. 