'use client';
/**
 * Sản phẩm theo brand cho mọi picker UI — thay cho SKUS tĩnh (danh tính loveintea).
 * L4 multi-brand-doctrine: UI không hardcode sản phẩm của bất kỳ store nào;
 * dropdown/nhãn đọc từ /api/products (brand-scoped qua middleware).
 */
import { useEffect, useState } from 'react';

export interface BrandProduct {
  id: string;
  slug?: string;
  name: string;
  display_name?: string;
  color?: string;
  theme?: string;
}

export function useBrandProducts(brandId?: string): BrandProduct[] {
  const [products, setProducts] = useState<BrandProduct[]>([]);
  useEffect(() => {
    let alive = true;
    const q = brandId ? `?brand=${encodeURIComponent(brandId)}` : '';
    fetch(`/api/products${q}`)
      .then(r => r.json())
      .then(d => { if (alive) setProducts(Array.isArray(d.products) ? d.products : []); })
      .catch(() => { /* giữ [] — picker hiện empty state */ });
    return () => { alive = false; };
  }, [brandId]);
  return products;
}

/** Tra tên sản phẩm theo id/slug — không tìm thấy trả chính id (không đoán sang brand khác). */
export function productLabel(products: BrandProduct[], id: string | null | undefined): string {
  if (!id) return '';
  const p = products.find(x => x.id === id || x.slug === id);
  return p ? (p.display_name || p.name) : id;
}
