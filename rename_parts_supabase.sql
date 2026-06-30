-- ============================================================
--  Đổi Part Name: Current → Standard
--  Bảng: production_records  |  Cột: part
--  Chạy trong: Supabase Dashboard → SQL Editor
--  Tác giả: Nam (QA) – 2026-06-29
-- ============================================================
--  KHUYẾN NGHỊ: Backup trước khi chạy bằng lệnh:
--    SELECT COUNT(*) FROM production_records;  -- đếm tổng để đối chiếu sau
-- ============================================================

BEGIN;

-- GEV -----------------------------------------------------------
UPDATE production_records SET part = '1.5 Pitch Bearing'
  WHERE TRIM(part) = '1.5MW Pitch';

UPDATE production_records SET part = '1.6 Hybrid Carbon Pitch Bearing'
  WHERE TRIM(part) = '1.6 Hybrid Pitch';

UPDATE production_records SET part = '1.x-97 Pitch Bearing'
  WHERE TRIM(part) = '1.X-97 Pitch';

UPDATE production_records SET part = '2.5-116 Pitch Bearing'
  WHERE TRIM(part) = '2.5 - 116 Pitch';

UPDATE production_records SET part = '2.x Yaw Bearing'
  WHERE TRIM(part) = '2.X YAW';

UPDATE production_records SET part = '2.8-127 Pitch O-Bearing'
  WHERE TRIM(part) = '2.X-127';

UPDATE production_records SET part = '3.x-130 Pitch O-Bearing'
  WHERE TRIM(part) = '3X130 PITCH';

UPDATE production_records SET part = 'Cypress Pitch Bearing'
  WHERE TRIM(part) = 'WT19 Cypress Pitch';

UPDATE production_records SET part = 'Cypress Yaw Bearing'
  WHERE TRIM(part) = 'WT19 Cypress Yaw';

UPDATE production_records SET part = 'Sierra N1 Pitch Bearing'
  WHERE TRIM(part) = 'WT20 N1 Pitch';

UPDATE production_records SET part = 'Sierra N1 Yaw Bearing'
  WHERE TRIM(part) = 'WT20 N1 Yaw';

UPDATE production_records SET part = 'WT20 Pitch O-Bearing'
  WHERE TRIM(part) = 'WT20 O-Brg';

-- SGRE ----------------------------------------------------------
UPDATE production_records SET part = 'SG8.0-167 Yaw Ring'
  WHERE TRIM(part) = 'D8 YAW RING';

UPDATE production_records SET part = 'SG129 MY20 Yaw Ring'
  WHERE TRIM(part) = 'SG129 MY20 Yaw';

UPDATE production_records SET part = '14MW Yaw Ring'
  WHERE TRIM(part) = 'SG14 Yaw Ring';

-- Vestas --------------------------------------------------------
UPDATE production_records SET part = '15MW Yaw Ring'
  WHERE TRIM(part) = 'Vestas 15MW';

UPDATE production_records SET part = '4MW Yaw Ring'
  WHERE TRIM(part) = 'Vestas 4MW';

UPDATE production_records SET part = 'V163 Blade Bearing'
  WHERE TRIM(part) = 'Vestas V163';

UPDATE production_records SET part = 'V172 Blade Bearing'
  WHERE TRIM(part) = 'Vestas V172';

-- ============================================================
--  Kiểm tra sau khi chạy (uncomment để xem):
-- ============================================================
-- SELECT part, COUNT(*) as cnt
-- FROM production_records
-- GROUP BY part
-- ORDER BY part;

COMMIT;
