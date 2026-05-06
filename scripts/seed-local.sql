-- Columna para credentials provider
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash text;

-- App settings
INSERT INTO app_settings (id) VALUES ('default') ON CONFLICT (id) DO NOTHING;

-- Justification types
INSERT INTO justification_types (code, label_es, counts_as_worked, color, icon, order_index, active) VALUES
('commission',      'Comisión / Trabajo externo', true,  '#3b82f6', 'briefcase',     1, true),
('medical',         'Permiso médico',             true,  '#10b981', 'stethoscope',   2, true),
('permit_paid',     'Permiso con goce',           true,  '#34d399', 'check-circle',  3, true),
('permit_unpaid',   'Permiso sin goce',           false, '#9ca3af', 'circle-slash',  4, true),
('vacation',        'Vacaciones',                 true,  '#a855f7', 'palmtree',      5, true),
('sick_leave',      'Licencia médica',            true,  '#f87171', 'heart-pulse',   6, true),
('absence',         'Falta injustificada',        false, '#ef4444', 'x-circle',      7, true),
('holiday_company', 'Feriado empresa',            true,  '#eab308', 'party-popper',  8, true),
('training',        'Capacitación',               true,  '#6366f1', 'graduation-cap',9, true),
('late_justified',  'Tardanza justificada',       true,  '#f97316', 'clock',         10, true)
ON CONFLICT (code) DO NOTHING;

-- Holidays PE 2026
INSERT INTO holidays (holiday_date, description, is_national) VALUES
('2026-01-01', 'Año Nuevo', true),
('2026-04-02', 'Jueves Santo', true),
('2026-04-03', 'Viernes Santo', true),
('2026-05-01', 'Día del Trabajo', true),
('2026-06-07', 'Batalla de Arica', true),
('2026-06-29', 'San Pedro y San Pablo', true),
('2026-07-23', 'Día de la Fuerza Aérea', true),
('2026-07-28', 'Independencia del Perú', true),
('2026-07-29', 'Independencia del Perú', true),
('2026-08-06', 'Batalla de Junín', true),
('2026-08-30', 'Santa Rosa de Lima', true),
('2026-10-08', 'Combate de Angamos', true),
('2026-11-01', 'Todos los Santos', true),
('2026-12-08', 'Inmaculada Concepción', true),
('2026-12-09', 'Batalla de Ayacucho', true),
('2026-12-25', 'Navidad', true)
ON CONFLICT (holiday_date) DO NOTHING;

-- Admin hardcodeado: admin@rrhh.com / password
INSERT INTO users (id, email, name, role, active, password_hash)
VALUES (
  gen_random_uuid()::text,
  'admin@rrhh.com',
  'Administrador',
  'admin',
  true,
  '$2b$10$ZOSRrayrRas6hZVl.Pfn/OW/rY.YrzLVZdfm5B3rIcsSjECFzeys2'
)
ON CONFLICT (email) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  role = 'admin',
  active = true;

-- Verificación
SELECT 'app_settings' AS tabla, COUNT(*) FROM app_settings
UNION ALL SELECT 'justification_types', COUNT(*) FROM justification_types
UNION ALL SELECT 'holidays', COUNT(*) FROM holidays
UNION ALL SELECT 'users (admin)', COUNT(*) FROM users WHERE email = 'admin@rrhh.com';
