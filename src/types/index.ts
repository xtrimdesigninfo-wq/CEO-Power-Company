export type UserRole = 'admin' | 'staff' | 'reseller';
export type UserStatus = 'active' | 'suspended';
export type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock';
export type OrderStatus = 'new' | 'confirmed' | 'fulfilled' | 'cancelled';
export type ResellerScope = 'all' | 'assigned';

export type PermissionKey =
  | 'dashboard.view'
  | 'products.view'
  | 'products.view_prices'
  | 'products.create'
  | 'products.edit'
  | 'products.edit_images'
  | 'products.edit_price'
  | 'products.edit_stock'
  | 'products.toggle_visibility'
  | 'products.bulk_edit'
  | 'products.delete'
  | 'categories.view'
  | 'categories.create_edit'
  | 'categories.reorder'
  | 'categories.toggle_visibility'
  | 'categories.delete'
  | 'resellers.view'
  | 'resellers.create'
  | 'resellers.edit'
  | 'resellers.reset_password'
  | 'resellers.suspend'
  | 'resellers.delete'
  | 'orders.view'
  | 'orders.update_status'
  | 'orders.export'
  | 'settings.view'
  | 'settings.edit';

export interface Profile {
  id: string;
  role: UserRole;
  username: string;
  email?: string | null;
  full_name: string;
  business_name: string;
  phone: string;
  state: string;
  city: string;
  status: UserStatus;
  assigned_staff_id?: string | null;
  last_sign_in_at?: string | null;
  created_at: string;
}

export interface StaffPermissionsRecord {
  user_id: string;
  permissions: PermissionKey[];
  category_scope: string[] | null;
  reseller_scope: ResellerScope;
  preset: string | null;
  updated_at?: string;
  updated_by?: string | null;
}

export interface StaffMember {
  profile: Profile;
  staff_permissions: StaffPermissionsRecord;
}

export interface AdminActivityLog {
  id: string;
  actor_id: string | null;
  actor?: {
    id: string;
    username: string;
    full_name: string;
    role: UserRole;
  } | null;
  action: string;
  entity: string;
  entity_id?: string | null;
  details: Record<string, any>;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  image_url?: string | null;
  sort_order: number;
  is_active: boolean;
  created_at?: string;
}

export interface Brand {
  id: string;
  category_id: string;
  name: string;
  slug: string;
  sort_order: number;
  created_at?: string;
}

export interface Product {
  id: string;
  category_id: string;
  name: string;
  slug: string;
  brand?: string | null;
  sku?: string | null;
  short_description?: string | null;
  specs: Record<string, string>;
  price: number;
  min_order_qty: number;
  stock_status: StockStatus;
  stock_quantity?: number | null;
  images: string[];
  is_active: boolean;
  is_featured: boolean;
  created_at: string;
  updated_at: string;
}

export interface AdminProduct extends Omit<Product, 'price'> {
  price: number | null;
}

export interface OrderItem {
  product_id: string;
  name: string;
  qty: number;
  unit_price: number;
  line_total: number;
  image?: string;
}

export interface OrderRequest {
  id: string;
  ref: string;
  reseller_id: string;
  items: OrderItem[];
  total: number;
  note?: string | null;
  status: OrderStatus;
  created_at: string;
  reseller?: Profile;
}

export interface CompanySettings {
  whatsapp_number: string;
  company_name: string;
  company_address: string;
  support_email: string;
  tagline?: string;
  est_year?: string;
  low_stock_threshold?: string | number;
}

export interface AdminNotification {
  id: string;
  type: 'low_stock' | 'out_of_stock';
  title: string;
  message: string;
  product_id: string;
  product_name: string;
  sku?: string | null;
  stock_quantity: number | null;
  stock_status: StockStatus;
  threshold: number;
  fingerprint: string;
  is_read: boolean;
  created_at: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
}
