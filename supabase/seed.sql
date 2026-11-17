-- ====================================================================
-- CEO Power Company — Reseller Portal Seed Data
-- ====================================================================

-- 1. Seed Settings
INSERT INTO public.settings (key, value) VALUES
  ('whatsapp_number', '2347066449882'),
  ('company_name', 'CEO Power Company'),
  ('company_address', '20 Oguta Road, Onitsha, Anambra State'),
  ('support_email', 'info@ceopowercompany.org'),
  ('tagline', 'Power Without Limits'),
  ('est_year', '2014')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- 2. Seed Categories (exact order specified)
INSERT INTO public.categories (id, name, slug, description, image_url, sort_order, is_active) VALUES
  (
    '11111111-1111-1111-1111-111111111101',
    'Solar Panels',
    'solar-panels',
    'High-efficiency monocrystalline Tier-1 solar PV modules from global manufacturers.',
    'https://images.unsplash.com/photo-1509391365360-2e959784a276?auto=format&fit=crop&w=800&q=80',
    1,
    true
  ),
  (
    '11111111-1111-1111-1111-111111111102',
    'Inverters',
    'inverters',
    'Pure sine wave hybrid, off-grid and on-grid inverters engineered for Nigerian grid conditions.',
    'https://images.unsplash.com/photo-1620714223084-8fcacc6dfd8d?auto=format&fit=crop&w=800&q=80',
    2,
    true
  ),
  (
    '11111111-1111-1111-1111-111111111103',
    'Lithium Batteries (ESS)',
    'lithium-batteries-ess',
    'LiFePO4 high-cycle energy storage systems with smart BMS and multi-unit paralleling.',
    'https://images.unsplash.com/photo-1558441719-8b459c86f6c0?auto=format&fit=crop&w=800&q=80',
    3,
    true
  ),
  (
    '11111111-1111-1111-1111-111111111104',
    'Charge Controllers',
    'charge-controllers',
    'Ultra-fast Maximum Power Point Tracking (MPPT) regulators maximizing solar harvest.',
    'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=800&q=80',
    4,
    true
  ),
  (
    '11111111-1111-1111-1111-111111111105',
    'Solar Accessories',
    'solar-accessories',
    'Certified DC cables, IP68 MC4 connectors, DC isolators, breakers and mounting rails.',
    'https://images.unsplash.com/photo-1544725176-7c40e5a71c5e?auto=format&fit=crop&w=800&q=80',
    5,
    true
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  slug = EXCLUDED.slug,
  description = EXCLUDED.description,
  image_url = EXCLUDED.image_url,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active;

-- 3. Seed Products
INSERT INTO public.products (
  id, category_id, name, slug, brand, sku, short_description, specs, price, min_order_qty, stock_status, images, is_active, is_featured
) VALUES
  -- Solar Panels
  (
    '22222222-2222-2222-2222-222222222101',
    '11111111-1111-1111-1111-111111111101',
    'ZN Shine 600W Solar Panel',
    'zn-shine-600w-solar-panel',
    'ZN Shine',
    'ZNS-600W-MONO',
    'High-output 600W Graphene-coated Tier-1 monocrystalline solar PV module with exceptional low-light yield.',
    '{"Wattage": "600W", "Cell Type": "Monocrystalline Perc", "Efficiency": "21.6%", "Voc": "49.8V", "Isc": "15.3A", "Dimensions": "2465 x 1134 x 35 mm", "Weight": "31.2 kg", "Warranty": "12-Year Product / 25-Year Linear Power"}'::jsonb,
    155000.00,
    1,
    'in_stock',
    ARRAY['https://images.unsplash.com/photo-1509391365360-2e959784a276?auto=format&fit=crop&w=800&q=80', 'https://images.unsplash.com/photo-1508873696983-2df570464756?auto=format&fit=crop&w=800&q=80'],
    true,
    true
  ),
  (
    '22222222-2222-2222-2222-222222222102',
    'Tongwei 620W Solar Panel',
    'tongwei-620w-solar-panel',
    'Tongwei',
    'TW-620W-SHINGLED',
    'High-density shingled monocrystalline solar panel engineered for heavy industrial and commercial rooftops.',
    '{"Wattage": "620W", "Cell Type": "N-Type Shingled Mono", "Efficiency": "22.1%", "Voc": "52.4V", "Isc": "15.1A", "Dimensions": "2384 x 1303 x 35 mm", "Warranty": "15-Year Product / 30-Year Performance"}'::jsonb,
    165000.00,
    1,
    'in_stock',
    ARRAY['https://images.unsplash.com/photo-1508873696983-2df570464756?auto=format&fit=crop&w=800&q=80'],
    true,
    false
  ),
  (
    '22222222-2222-2222-2222-222222222103',
    'LONGi 635W Solar Panel',
    'longi-635w-solar-panel',
    'LONGi',
    'LR5-72HGD-635M',
    'Hi-MO 5 Bifacial dual-glass module with ultra-low degradation and superior temperature coefficient.',
    '{"Wattage": "635W", "Cell Type": "Bifacial Half-Cut Mono", "Efficiency": "22.5%", "Bifaciality": "70±5%", "Voc": "53.2V", "Isc": "15.4A", "Warranty": "12-Year Product / 30-Year Power"}'::jsonb,
    175000.00,
    1,
    'in_stock',
    ARRAY['https://images.unsplash.com/photo-1509391365360-2e959784a276?auto=format&fit=crop&w=800&q=80'],
    true,
    true
  ),
  (
    '22222222-2222-2222-2222-222222222104',
    'LONGi 645W Solar Panel',
    'longi-645w-solar-panel',
    'LONGi',
    'LR5-72HGD-645M',
    'High-power 645W Hi-MO 7 with HPDC technology delivering maximum energy yield per square meter.',
    '{"Wattage": "645W", "Cell Type": "HPDC N-Type Mono", "Efficiency": "22.8%", "Voc": "54.1V", "Isc": "15.5A", "Warranty": "15-Year Product / 30-Year Power"}'::jsonb,
    185000.00,
    1,
    'in_stock',
    ARRAY['https://images.unsplash.com/photo-1508873696983-2df570464756?auto=format&fit=crop&w=800&q=80'],
    true,
    false
  ),
  (
    '22222222-2222-2222-2222-222222222105',
    'Jinko 580W Solar Panel',
    'jinko-580w-solar-panel',
    'Jinko',
    'JKM-580N-72HL4',
    'Tiger Neo N-type TopCon solar module providing higher bifacial gain and lower BOS cost.',
    '{"Wattage": "580W", "Cell Type": "TopCon N-Type Mono", "Efficiency": "22.3%", "Voc": "51.2V", "Isc": "14.3A", "Warranty": "12-Year Product / 30-Year Power"}'::jsonb,
    145000.00,
    1,
    'low_stock',
    ARRAY['https://images.unsplash.com/photo-1509391365360-2e959784a276?auto=format&fit=crop&w=800&q=80'],
    true,
    false
  ),

  -- Inverters
  (
    '22222222-2222-2222-2222-222222222201',
    '11111111-1111-1111-1111-111111111102',
    'Felicity 3kVA Hybrid Inverter 24V',
    'felicity-3kva-hybrid-inverter-24v',
    'Felicity',
    'FL-IVPS-3024',
    'Compact 3kVA / 2.4kW pure sine wave hybrid inverter with built-in 80A MPPT controller.',
    '{"Rated Power": "3000VA / 2400W", "Battery Voltage": "24V DC", "MPPT Max PV Input": "145V DC", "Max PV Array": "2000W", "Output": "230V AC Pure Sine Wave", "Warranty": "2 Years"}'::jsonb,
    580000.00,
    1,
    'in_stock',
    ARRAY['https://images.unsplash.com/photo-1620714223084-8fcacc6dfd8d?auto=format&fit=crop&w=800&q=80'],
    true,
    false
  ),
  (
    '22222222-2222-2222-2222-222222222202',
    'Deye 5kVA Hybrid Inverter 48V',
    'deye-5kva-hybrid-inverter-48v',
    'Deye',
    'SUN-5K-SG03LP1-EU',
    'Industry-leading 5kW low-voltage single phase hybrid inverter with dual MPPT and generator auto-start.',
    '{"Rated Power": "5000W", "Max DC Input": "6500W", "Battery Voltage": "48V DC (40-60V)", "Max Charge/Discharge": "120A", "MPPT Trackers": "2 Trackers", "Bypass Current": "35A", "Warranty": "5 Years"}'::jsonb,
    1250000.00,
    1,
    'in_stock',
    ARRAY['https://images.unsplash.com/photo-1620714223084-8fcacc6dfd8d?auto=format&fit=crop&w=800&q=80'],
    true,
    true
  ),
  (
    '22222222-2222-2222-2222-222222222203',
    'Sunsynk 8kVA Hybrid Inverter 48V',
    'sunsynk-8kva-hybrid-inverter-48v',
    'Sunsynk',
    'SUN-8K-SG01LP1',
    'Heavy-duty 8kW hybrid inverter with Wi-Fi monitoring dongle, parallel support up to 16 units.',
    '{"Rated Power": "8000W", "Max DC Input": "10400W", "Battery Voltage": "48V DC", "Max Charge/Discharge": "190A", "Surge Power": "16000VA (10s)", "Efficiency": "97.6%", "Warranty": "5 Years"}'::jsonb,
    2100000.00,
    1,
    'in_stock',
    ARRAY['https://images.unsplash.com/photo-1620714223084-8fcacc6dfd8d?auto=format&fit=crop&w=800&q=80'],
    true,
    false
  ),
  (
    '22222222-2222-2222-2222-222222222204',
    'Growatt 10kVA Hybrid Inverter 48V',
    'growatt-10kva-hybrid-inverter-48v',
    'Growatt',
    'SPH-10000TL3-BH-UP',
    'Robust 10kVA three-phase/split-phase hybrid inverter for luxury residential estates and commercial buildings.',
    '{"Rated Power": "10000W", "Max PV Input": "15000W", "Battery Voltage": "48V DC", "Output": "400/230V AC", "Protection": "IP65 Weatherproof", "Warranty": "5 Years"}'::jsonb,
    2650000.00,
    1,
    'low_stock',
    ARRAY['https://images.unsplash.com/photo-1620714223084-8fcacc6dfd8d?auto=format&fit=crop&w=800&q=80'],
    true,
    false
  ),

  -- Lithium Batteries (ESS)
  (
    '22222222-2222-2222-2222-222222222301',
    '11111111-1111-1111-1111-111111111103',
    'Felicity 5kWh 48V LiFePO4 Lithium Battery',
    'felicity-5kwh-48v-lifepo4-battery',
    'Felicity',
    'FL-LPBF48100-H',
    '51.2V 100Ah 5.12kWh wall-mounted lithium iron phosphate battery with CAN/RS485 smart inverter communication.',
    '{"Capacity": "5.12 kWh / 100Ah", "Nominal Voltage": "51.2V", "Max Discharge Current": "100A", "Cycle Life": "6000+ Cycles @ 80% DOD", "BMS Protection": "Overcharge, Overdischarge, Temp", "Warranty": "5 Years"}'::jsonb,
    1450000.00,
    1,
    'in_stock',
    ARRAY['https://images.unsplash.com/photo-1558441719-8b459c86f6c0?auto=format&fit=crop&w=800&q=80'],
    true,
    true
  ),
  (
    '22222222-2222-2222-2222-222222222302',
    'Pylontech 10kWh 48V LiFePO4 Battery Bank',
    'pylontech-10kwh-48v-lifepo4-battery-bank',
    'Pylontech',
    'US5000-2X-COMBO',
    'Dual 4.8kWh US5000 rack-mounted module system delivering 9.6kWh usable energy with proven longevity.',
    '{"Capacity": "9.6 kWh / 200Ah", "Nominal Voltage": "48V", "Recommended Discharge": "100A", "Depth of Discharge": "95%", "Communication": "CAN, RS485", "Warranty": "10 Years"}'::jsonb,
    2850000.00,
    1,
    'in_stock',
    ARRAY['https://images.unsplash.com/photo-1558441719-8b459c86f6c0?auto=format&fit=crop&w=800&q=80'],
    true,
    false
  ),
  (
    '22222222-2222-2222-2222-222222222303',
    'CEO Power 16kWh High-Capacity Stacked ESS',
    'ceo-power-16kwh-stacked-ess',
    'CEO Power',
    'CEO-ESS-16K-STK',
    'Commercial-grade modular stacked energy storage system with integrated master control unit and active balancing.',
    '{"Capacity": "16.38 kWh", "Nominal Voltage": "51.2V / 320Ah", "Continuous Discharge": "150A", "Peak Discharge": "200A (15s)", "Enclosure": "Heavy-duty Industrial Steel", "Warranty": "7 Years"}'::jsonb,
    4400000.00,
    1,
    'in_stock',
    ARRAY['https://images.unsplash.com/photo-1558441719-8b459c86f6c0?auto=format&fit=crop&w=800&q=80'],
    true,
    false
  ),

  -- Charge Controllers
  (
    '22222222-2222-2222-2222-222222222401',
    '11111111-1111-1111-1111-111111111104',
    'SRNE 60A MPPT Solar Charge Controller 12V/24V/48V',
    'srne-60a-mppt-solar-charge-controller',
    'SRNE',
    'MC-4860N15',
    'High-speed MPPT algorithm controller with auto-detect 12V/24V/36V/48V voltage and backlit LCD display.',
    '{"Rated Current": "60A", "System Voltage": "12V / 24V / 36V / 48V Auto", "Max PV Open Voltage": "150V", "Max PV Input Power": "3200W (48V)", "Tracking Efficiency": "≥ 99.5%", "Warranty": "2 Years"}'::jsonb,
    140000.00,
    1,
    'in_stock',
    ARRAY['https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=800&q=80'],
    true,
    false
  ),
  (
    '22222222-2222-2222-2222-222222222402',
    'Fangpusun 100A MPPT High-Efficiency Controller',
    'fangpusun-100a-mppt-controller',
    'Fangpusun',
    'FP-MPPT-150-100',
    'Heavy-duty 100A MPPT regulator engineered for high-voltage PV strings with Bluetooth dongle support.',
    '{"Rated Current": "100A", "System Voltage": "12V / 24V / 48V", "Max PV Voltage": "150V", "Max PV Power": "5800W (48V)", "Cooling": "Cast Aluminum Heat Sink", "Warranty": "2 Years"}'::jsonb,
    260000.00,
    1,
    'in_stock',
    ARRAY['https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=800&q=80'],
    true,
    false
  ),

  -- Solar Accessories
  (
    '22222222-2222-2222-2222-222222222501',
    '11111111-1111-1111-1111-111111111105',
    'KBE 6mm² PV Solar Cable (100m Roll, Black/Red)',
    'kbe-6mm-pv-solar-cable-100m',
    'KBE Germany',
    'KBE-6MM-100M',
    'TÜV certified double insulated solar photovoltaic cable resistant to UV, ozone and extreme African temperatures.',
    '{"Conductor": "Tinned Copper 6mm²", "Length": "100 Meters Roll", "Voltage Rating": "1500V DC", "Standard": "EN 50618 TÜV", "Temp Range": "-40°C to +90°C"}'::jsonb,
    68000.00,
    1,
    'in_stock',
    ARRAY['https://images.unsplash.com/photo-1544725176-7c40e5a71c5e?auto=format&fit=crop&w=800&q=80'],
    true,
    false
  ),
  (
    '22222222-2222-2222-2222-222222222502',
    'Staubli MC4 Solar Connectors (Pair M/F IP68)',
    'staubli-mc4-solar-connectors-pair',
    'Staubli',
    'MC4-PV-KBT4-SET',
    'Original Swiss-engineered MC4 male/female connectors rated for 1500V DC with snap-in lock mechanism.',
    '{"Type": "Male & Female Pair", "Rated Current": "39A", "Protection": "IP68 Waterproof", "Cable Size": "4mm² - 6mm²", "Material": "UV Resistant Polyamide"}'::jsonb,
    2500.00,
    10,
    'in_stock',
    ARRAY['https://images.unsplash.com/photo-1544725176-7c40e5a71c5e?auto=format&fit=crop&w=800&q=80'],
    true,
    false
  ),
  (
    '22222222-2222-2222-2222-222222222503',
    'Tomzn 63A 2P DC Miniature Circuit Breaker (550V)',
    'tomzn-63a-2p-dc-breaker-550v',
    'Tomzn',
    'TOB1Z-63-2P',
    'Non-polarity DC MCB designed for solar PV string overcurrent and short-circuit protection.',
    '{"Rated Current": "63A", "Poles": "2P", "Rated Voltage": "550V DC", "Breaking Capacity": "6kA", "Mounting": "Standard 35mm DIN Rail"}'::jsonb,
    12500.00,
    2,
    'in_stock',
    ARRAY['https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=800&q=80'],
    true,
    false
  ),
  (
    '22222222-2222-2222-2222-222222222504',
    'CEO Heavy-Duty Anodized Aluminum Panel Mounting Rail Kit',
    'ceo-aluminum-panel-mounting-rail-kit',
    'CEO Power',
    'CEO-MNT-ALUM-KIT',
    'Complete roof mounting kit including 2x 2.4m anodized AL6005-T5 rails, mid-clamps, end-clamps and L-feet.',
    '{"Rail Length": "2 x 2.4 Meters (4.8m total)", "Material": "Anodized Aluminum AL6005-T5", "Hardware": "SUS304 Stainless Steel", "Wind Load": "Up to 60 m/s", "Snow Load": "1.4 kN/m²"}'::jsonb,
    35000.00,
    1,
    'in_stock',
    ARRAY['https://images.unsplash.com/photo-1509391365360-2e959784a276?auto=format&fit=crop&w=800&q=80'],
    true,
    false
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  slug = EXCLUDED.slug,
  brand = EXCLUDED.brand,
  sku = EXCLUDED.sku,
  short_description = EXCLUDED.short_description,
  specs = EXCLUDED.specs,
  price = EXCLUDED.price,
  min_order_qty = EXCLUDED.min_order_qty,
  stock_status = EXCLUDED.stock_status,
  images = EXCLUDED.images,
  is_active = EXCLUDED.is_active,
  is_featured = EXCLUDED.is_featured;

-- 4. Admin Seeding Script helper (can be run in Supabase SQL editor)
-- This creates the admin user if not exists using Supabase auth schema and links profile.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  v_admin_email text := 'xtrimdesign@portal.ceopower.local';
  v_admin_id uuid;
BEGIN
  -- Ensure extensions schema is visible for crypt/gen_salt
  PERFORM set_config('search_path', 'public, auth, extensions', true);

  -- Check if user already exists in auth.users
  SELECT id INTO v_admin_id FROM auth.users WHERE email = v_admin_email;

  IF v_admin_id IS NULL THEN
    v_admin_id := gen_random_uuid();

    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_admin_id,
      'authenticated',
      'authenticated',
      v_admin_email,
      crypt('Le123456789', gen_salt('bf')),
      now(),
      '',
      '',
      '',
      '',
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"role":"admin","username":"xtrimdesign","full_name":"CEO Power Administrator"}'::jsonb,
      now(),
      now()
    );
  ELSE
    UPDATE auth.users
    SET
      email_confirmed_at = COALESCE(email_confirmed_at, now()),
      confirmation_token = COALESCE(confirmation_token, ''),
      recovery_token = COALESCE(recovery_token, ''),
      email_change_token_new = COALESCE(email_change_token_new, ''),
      email_change = COALESCE(email_change, ''),
      updated_at = now()
    WHERE id = v_admin_id;
  END IF;

  -- Ensure matching auth.identities record exists for GoTrue password sign-in
  IF NOT EXISTS (
    SELECT 1 FROM auth.identities WHERE user_id = v_admin_id AND provider = 'email'
  ) THEN
    INSERT INTO auth.identities (
      id,
      provider_id,
      user_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      v_admin_id::text,
      v_admin_id,
      jsonb_build_object(
        'sub', v_admin_id::text,
        'email', v_admin_email,
        'email_verified', true,
        'phone_verified', false
      ),
      'email',
      now(),
      now(),
      now()
    );
  END IF;

  -- Ensure profile exists and is set to admin
  INSERT INTO public.profiles (
    id,
    role,
    username,
    full_name,
    business_name,
    phone,
    state,
    city,
    status
  ) VALUES (
    v_admin_id,
    'admin',
    'xtrimdesign',
    'CEO Power Administrator',
    'CEO Power Company HQ',
    '2347066449882',
    'Anambra State',
    'Onitsha',
    'active'
  )
  ON CONFLICT (id) DO UPDATE SET
    role = 'admin',
    status = 'active',
    username = 'xtrimdesign';
END;
$$;
