# 🌌 CardTKB - 3D Galaxy Card-Battler Scheduler

[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![Three.js](https://img.shields.io/badge/Three.js-R3F-blueviolet?style=for-the-badge&logo=three.js)](https://threejs.org/)
[![Prisma](https://img.shields.io/badge/Prisma-ORM-teal?style=for-the-badge&logo=prisma)](https://prisma.io)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon-blue?style=for-the-badge&logo=postgresql)](https://neon.tech)
[![TailwindCSS](https://img.shields.io/badge/Tailwind-CSS-38B2AC?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com)

**CardTKB** là một ứng dụng đột phá giúp trực quan hóa thời khóa biểu học tập của sinh viên thành một **bàn cờ 3D vũ trụ (Galaxy Board)**. Thay vì nhìn vào những bảng biểu Excel hay danh sách tiết học khô khan, sinh viên sẽ sắp xếp lịch học của mình dưới dạng các **"Thẻ Bài Môn Học"** mang chỉ số sức mạnh riêng, kết hợp cơ chế hợp tác nhóm thời gian thực (Real-time Co-Op) độc nhất vô nhị.

---

## 🚀 Tính Năng Cốt Lõi (Core Features)

### 1. 🌌 Bàn Cờ Thiên Hà 3D & Kéo Thả (Galaxy Board 3D)
*   **Hệ thống thẻ bài (Deck & Cards):** Mỗi môn học được đại diện bởi một thẻ bài neon phát sáng, hiển thị đầy đủ thông tin: Mã môn, Tên môn, Số tín chỉ, Giảng viên, Mã lớp.
*   **Tương tác 3D:** Sử dụng chuột để xoay, thu phóng và kéo các thẻ bài trực tiếp từ kho đồ (Deck) và thả vào các ô Thứ/Tiết trên bàn cờ không gian 3D.

### 2. 👥 Sảnh Vũ Trụ Nhóm (Real-time Co-Op Lobby & Orbit Merging)
*   **Galaxy Lobby:** Tạo phòng học nhóm thông qua mã phòng duy nhất (`ROOM-XXXX`).
*   **Hợp thể bàn cờ (Orbit Merging):** Khi bạn bè tham gia phòng, bàn cờ TKB của mỗi người sẽ bay vào trung tâm màn hình dưới dạng các quỹ đạo neon chuyển động.
*   **Vành đai thiên thạch (Meteor Belts):** Các ca học bận của bạn bè sẽ hiển thị dưới dạng các vành đai thiên thạch bán trong suốt chặn dòng thời gian trên bàn cờ.
*   **Cổng Không Gian Rảnh Chung (Space Gates / Wormholes):** Tự động phát hiện các ô Thứ/Tiết trống chung của toàn bộ nhóm và mở ra các hố đen/cổng không gian màu xanh lục rực rỡ, giúp việc hẹn lịch học nhóm hoặc đi chơi cực kỳ nhanh chóng.

### 3. 🤖 Trợ Lý Phi Hành Gia Ảo (Gemini & Leo AI Chatbot)
*   Tích hợp chatbot thông minh hỗ trợ bởi mô hình **Llama 3.3 (qua Groq API Key)**.
*   Trợ lý có khả năng đọc hiểu TKB hiện tại của bạn, đề xuất phân bổ lịch học tối ưu, nhắc nhở các ca học liên tục quá dài.

### 4. 👥 Quản Lý Bạn Bè & Chat Trực Tiếp (Friend & Private Chat Hub)
*   **Hệ thống kết bạn (Friend Request):** Tìm bạn bằng ID hoặc Tên hiển thị (username). Gửi lời mời và phê duyệt yêu cầu kết bạn thời gian thực.
*   **Trò chuyện riêng tư:** Chỉ nhắn tin với những người đã là bạn bè, hiển thị tên của họ thay vì email, hỗ trợ gửi kèm ảnh và tệp tài liệu học tập.

### 5. 📤 Nhập/Xuất Dữ Liệu Thông Minh (Smart Import & Export)
*   **Import thô:** Copy nhanh danh sách môn học từ trang đào tạo của trường đại học và paste trực tiếp vào hệ thống để tự tạo kho thẻ bài.
*   **Xuất lịch ICS:** Xuất thời khóa biểu đã xếp thành file `.ics` để đồng bộ trực tiếp sang Google Calendar, Apple Calendar.
*   **Lưu nháp nhiều phương án:** Hỗ trợ tạo và chuyển đổi linh hoạt giữa nhiều phương án xếp lịch (Phương án A, B, C...) được lưu trên Cloud.

---

## 🛠️ Công Nghệ Sử Dụng (Tech Stack)

*   **Frontend:** Next.js (App Router), React 19, TailwindCSS, Framer Motion.
*   **Đồ họa 3D:** Three.js, React Three Fiber (R3F), `@react-three/drei`.
*   **Backend:** Next.js API Routes, Middleware.
*   **Database & ORM:** PostgreSQL (hosted trên Neon Server), Prisma ORM.
*   **Xác thực (Authentication):** JWT (JSON Web Token), Nhận diện khuôn mặt (Face Recognition API).
*   **Quản lý State:** Zustand.

---

## 💻 Hướng Dẫn Cài Đặt (Local Setup)

Yêu cầu máy tính đã cài đặt **Node.js** (phiên bản v18 trở lên).

### Bước 1: Clone dự án
```bash
git clone https://github.com/your-username/QL_TKB_Nhan.git
cd QL_TKB_Nhan
```

### Bước 2: Cài đặt thư viện phụ thuộc
```bash
npm install
```

### Bước 3: Thiết lập file môi trường `.env`
Tạo một file `.env` ở thư mục gốc của dự án với các thông số sau:
```env
DATABASE_URL="postgresql://username:password@host/neondb?sslmode=require"
JWT_SECRET="your-super-secret-key-3d-space"
GROQ_API_KEY="optional-if-configured-locally"
```

### Bước 4: Đồng bộ cấu trúc Database với Prisma
```bash
npx prisma db push
npx prisma generate
```

### Bước 5: Khởi động Server chạy thử nghiệm (Dev Server)
```bash
npm run dev
```
Mở trình duyệt truy cập đường dẫn: [http://localhost:3001](http://localhost:3001) để trải nghiệm ứng dụng.

---

## 📌 Cách Tải TKB Lên Google Calendar (Hướng Dẫn Nhanh)
1.  Sắp xếp lịch học hoàn chỉnh trên Bàn cờ 3D.
2.  Bấm vào Tab **Lưu & Xuất Bản** bên bảng tiện ích bên phải.
3.  Nhập ngày bắt đầu học kỳ (Ví dụ: Thứ Hai tuần đầu tiên) và bấm **XUẤT FILE LỊCH (.ICS)**.
4.  Mở [Google Calendar](https://calendar.google.com/), vào phần Cài đặt -> Nhập & Xuất -> Upload file `.ics` vừa tải xuống để xem lịch trên điện thoại.

---

## 📄 Giấy Phép (License)
Dự án được phân phối dưới giấy phép **MIT License**. Bạn có thể tự do clone, chỉnh sửa và chia sẻ.
