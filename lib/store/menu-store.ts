import fs from 'fs';
import path from 'path';
import { MenuItem, Category } from '@/types';
import { INITIAL_CATEGORIES, INITIAL_MENU_ITEMS } from '@/lib/data/mock-menu';

const DATA_DIR = path.join(process.cwd(), 'data');
const MENU_DATA_FILE = path.join(DATA_DIR, 'menu-data.json');

interface PersistedMenuData {
  categories: Category[];
  menuItems: MenuItem[];
}

declare global {
  var __GLOBAL_MENU_ITEMS__: MenuItem[] | undefined;
  var __GLOBAL_CATEGORIES__: Category[] | undefined;
}

function loadPersistedData(): PersistedMenuData {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (fs.existsSync(MENU_DATA_FILE)) {
      const content = fs.readFileSync(MENU_DATA_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed.categories) && Array.isArray(parsed.menuItems)) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Failed to load menu-data.json, fallback to defaults:', err);
  }

  // Fallback defaults
  const defaults: PersistedMenuData = {
    categories: [],
    menuItems: [...INITIAL_MENU_ITEMS],
  };

  savePersistedData(defaults);
  return defaults;
}

function savePersistedData(data: PersistedMenuData): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(MENU_DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Failed to save menu-data.json:', err);
  }
}

function initMemoryStore(): { categories: Category[]; menuItems: MenuItem[] } {
  if (global.__GLOBAL_CATEGORIES__ === undefined || global.__GLOBAL_MENU_ITEMS__ === undefined) {
    const data = loadPersistedData();
    global.__GLOBAL_CATEGORIES__ = data.categories;
    global.__GLOBAL_MENU_ITEMS__ = data.menuItems;
  }
  return {
    categories: global.__GLOBAL_CATEGORIES__,
    menuItems: global.__GLOBAL_MENU_ITEMS__,
  };
}

function persistCurrentState(): void {
  const categories = global.__GLOBAL_CATEGORIES__ || [];
  const menuItems = global.__GLOBAL_MENU_ITEMS__ || [];
  savePersistedData({ categories, menuItems });
}

// ==================== CATEGORIES CRUD ====================

export function getLocalCategories(): Category[] {
  const store = initMemoryStore();
  return store.categories;
}

export function addLocalCategory(name: string, sort_order?: number): Category {
  const store = initMemoryStore();
  const trimmed = name.trim();
  const id = `cat-${trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || Date.now()}`;
  
  // Periksa apakah ID sudah ada
  let finalId = id;
  let counter = 1;
  while (store.categories.some((c) => c.id === finalId)) {
    finalId = `${id}-${counter++}`;
  }

  const nextOrder = sort_order ?? (store.categories.length > 0 
    ? Math.max(...store.categories.map((c) => c.sort_order || 0)) + 1 
    : 1);

  const newCategory: Category = {
    id: finalId,
    name: trimmed,
    sort_order: nextOrder,
  };

  store.categories.push(newCategory);
  persistCurrentState();
  return newCategory;
}

export function updateLocalCategory(id: string, name: string, sort_order?: number): Category | null {
  const store = initMemoryStore();
  const idx = store.categories.findIndex((c) => c.id === id);
  if (idx === -1) return null;

  store.categories[idx] = {
    ...store.categories[idx],
    name: name.trim(),
    ...(sort_order !== undefined ? { sort_order } : {}),
  };

  persistCurrentState();
  return store.categories[idx];
}

export function deleteLocalCategory(id: string): boolean {
  const store = initMemoryStore();
  const initialLength = store.categories.length;
  store.categories = store.categories.filter((c) => c.id !== id);
  global.__GLOBAL_CATEGORIES__ = store.categories;

  if (store.categories.length < initialLength) {
    persistCurrentState();
    return true;
  }
  return false;
}

// ==================== MENU ITEMS CRUD ====================

export function getLocalMenuItems(): MenuItem[] {
  const store = initMemoryStore();
  return store.menuItems;
}

export function addLocalMenuItem(item: MenuItem): MenuItem {
  const store = initMemoryStore();
  store.menuItems.unshift(item);
  persistCurrentState();
  return item;
}

export function updateLocalMenuItem(id: string, updated: Partial<MenuItem>): MenuItem | null {
  const store = initMemoryStore();
  const idx = store.menuItems.findIndex((m) => m.id === id);
  if (idx === -1) return null;

  store.menuItems[idx] = {
    ...store.menuItems[idx],
    ...updated,
  };

  persistCurrentState();
  return store.menuItems[idx];
}

export function deleteLocalMenuItem(id: string): boolean {
  const store = initMemoryStore();
  const initialLength = store.menuItems.length;
  store.menuItems = store.menuItems.filter((m) => m.id !== id);
  global.__GLOBAL_MENU_ITEMS__ = store.menuItems;

  if (store.menuItems.length < initialLength) {
    persistCurrentState();
    return true;
  }
  return false;
}
