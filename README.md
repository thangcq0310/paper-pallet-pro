# Mini WMS — Manual Warehouse

Ứng dụng Mini WMS nội bộ dành cho kho **không có WMS chính thức và không dùng barcode/scanner**. Mọi thao tác đều thực hiện thủ công: nhập tay, chọn dropdown, bấm xác nhận, in/dán nhãn pallet giấy.

## Tính năng

- **Dashboard** bento: KPI tồn kho, occupancy, in/out hôm nay, task đang mở.
- **Master Data**: SKU, Batch, Location (block/unblock, capacity).
- **Inbound flow**: Create Pallet Label → Print → Confirm Label Attached → Tạo Putaway Task → Confirm Actual Location → In Stock.
- **Inventory**: lọc theo SKU, Batch, Location, Status, search.
- **Move Location**: chuyển pallet giữa các bin, có validate capacity/blocked.
- **Outbound**: gợi ý pallet theo **FEFO → FIFO**, Pick → Stage → Load → Out.
- **Tasks**: PUTAWAY / MOVE / PICK / LOAD với confirm/cancel.
- **Movement History**: log đầy đủ, không sửa không xoá.
- **Alerts**: pallet chờ dán nhãn, chờ putaway, location đầy/blocked, gần hết hạn, task quá hạn.
- **Pallet Label Preview** in được bằng `window.print()` (CSS `@media print`).

## Công nghệ

- React 19 + TypeScript + Vite 7
- TanStack Start (file-based routing) + TanStack Query
- Tailwind CSS v4 + shadcn/ui
- Service layer độc lập (`src/services/`) để **dễ thay bằng Firebase Firestore** sau này
- State chạy qua `useSyncExternalStore`, persist `localStorage`

## Chạy

```bash
npm install
npm run dev
```

Mở http://localhost:5173

## Build & Deploy

- Build production: `npm run build` (output vào thư mục `dist/`).
- Firebase deploy dùng cấu hình `hosting.public = "dist"` trong `firebase.json`.
- Không deploy từ `public/` hoặc các thư mục artifact tạm.

## Cấu trúc

```
src/
  components/
    layout/AppSidebar.tsx
    PageHeader.tsx
    StatusBadges.tsx
    ui/...                  # shadcn
  routes/                   # TanStack file-based routes
    __root.tsx              # layout + sidebar
    index.tsx               # Dashboard
    master.sku.tsx
    master.batch.tsx
    master.location.tsx
    pallet.create.tsx
    pallet.$palletId.tsx    # Label preview / print
    putaway.tsx
    inventory.tsx
    move.tsx
    outbound.tsx
    tasks.tsx
    movements.tsx
    alerts.tsx
  services/
    store.ts                # reactive in-memory store + localStorage
    masterService.ts
    palletService.ts        # business rules cho pallet/movement
    taskService.ts
    outboundService.ts
    movementService.ts
  types/index.ts
  data/mockData.ts          # demo SKU/Batch/Location/Pallet
  utils/idGenerator.ts      # PLT-YYYYMMDD-####, MV-####, TASK-####
```

## Business rules được enforce

- Pallet ID duy nhất, format `PLT-YYYYMMDD-0001`.
- Không putaway nếu chưa `labelAttached`.
- Không đưa pallet vào location `Blocked` hoặc đã đầy.
- Không move/pick/load pallet đã `Shipped`.
- Một pallet chỉ ở một location tại một thời điểm; occupancy auto cập nhật.
- Mọi thay đổi đều ghi `Movement History`.

## Kết nối Firebase Firestore (bước sau)

Toàn bộ nghiệp vụ tập trung trong `src/services/*.ts`. Cách thay:

1. `npm install firebase`
2. Tạo `src/services/firebase.ts` với `initializeApp` + `getFirestore`.
3. Trong từng `*Service.ts`, thay các hàm `getState()/setState()` bằng Firestore SDK:
   - `addSKU` → `addDoc(collection(db, "skus"), ...)`
   - `listSKUs` → `getDocs` / `onSnapshot`
   - `recordMovement` → `addDoc(collection(db, "movements"), ...)`
   - Pallet/location update → `runTransaction` để đảm bảo atomicity (đặc biệt cho occupancy).
4. Thay `useStore(selector)` bằng `useCollectionData` (react-firebase-hooks) hoặc TanStack Query với `onSnapshot`.
5. Component UI không đổi vì chỉ gọi service.

Bảo mật: thêm Firestore rules theo `auth.uid` và role nhân viên kho.

## Reset dữ liệu demo

Mở DevTools Console:

```js
localStorage.removeItem("mini-wms-state-v2"); location.reload();
```
