export type OrderStatus = 
  | 'MENUNGGU_BAYAR' 
  | 'DIPROSES' 
  | 'SIAP_DIAMBIL' 
  | 'SELESAI' 
  | 'BATAL';

export type PickupType = 'AMBIL_SENDIRI' | 'DRIVER_OJOL';

export interface Category {
  id: string;
  name: string;
  sort_order: number;
}

export interface ModifierOption {
  id: string;
  group_id: string;
  name: string;
  price: number;
  is_available: boolean;
}

export interface ModifierGroup {
  id: string;
  menu_item_id: string;
  title: string;
  is_required: boolean;
  min_selection: number;
  max_selection: number;
  options: ModifierOption[];
}

export interface MenuItem {
  id: string;
  category_id: string;
  name: string;
  description: string | null;
  base_price: number;
  image_url: string | null;
  is_available: boolean;
  modifier_groups?: ModifierGroup[];
}

export interface SelectedModifier {
  groupTitle: string;
  optionId: string;
  optionName: string;
  price: number;
  quantity?: number;
}

export interface CartItem {
  id: string; // unique cart line id (e.g. uuid or timestamp)
  menuItemId: string;
  name: string;
  basePrice: number;
  quantity: number;
  notes: string;
  selectedModifiers: SelectedModifier[];
  itemTotal: number;
}

export interface OrderItem {
  id: string;
  order_id: string;
  menu_item_id: string | null;
  item_name: string;
  base_price: number;
  quantity: number;
  notes: string | null;
  subtotal: number;
  modifiers?: {
    id: string;
    group_title: string;
    option_name: string;
    price: number;
    quantity?: number;
  }[];
}

export interface Order {
  id: string;
  daily_queue_number: number;
  queue_code: string;
  table_number?: string | null;
  customer_name: string;
  customer_phone: string;
  pickup_type: PickupType;
  is_asap: boolean;
  pickup_scheduled_time: string | null;
  notes: string | null;
  status: OrderStatus;
  total_amount: number;
  payment_method: 'CASH' | 'QRIS' | null;
  paid_at: string | null;
  created_at: string;
  items?: OrderItem[];
}
