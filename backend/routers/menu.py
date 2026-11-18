import json
import os
import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy import func
from sqlalchemy.orm import Session
from auth_dep import require_admin
from database import get_db
from models import MenuItem, OrderItem
from routers.uploads import MAX_MENU_BYTES, MENU_DIR, save_image
from schemas import MenuItemCreate, MenuItemUpdate, MenuItemResponse

router = APIRouter(prefix="/menu", tags=["Menu Management"])


def _normalize_bundle(is_bundle, bundle_items, db: Session, self_id=None):
    """Validasi & normalisasi isi paket bundling.

    Mengembalikan JSON string '[{"id": ..., "quantity": ...}]' atau None
    (bukan paket). Melempar 422 bila isi tidak valid.
    """
    if not is_bundle:
        return None
    try:
        lines = json.loads(bundle_items or "[]")
    except (ValueError, TypeError):
        raise HTTPException(status_code=422, detail="Isi paket tidak valid (bukan JSON).")
    if not isinstance(lines, list) or not lines:
        raise HTTPException(status_code=422, detail="Paket bundling wajib berisi minimal 1 menu.")
    normalized = []
    for line in lines:
        if not isinstance(line, dict):
            raise HTTPException(status_code=422, detail="Isi paket tidak valid.")
        comp_id = (line.get("id") or "").strip()
        qty = int(line.get("quantity") or 0)
        if not comp_id or qty <= 0:
            raise HTTPException(status_code=422, detail="Setiap isi paket wajib punya menu & jumlah > 0.")
        if comp_id == self_id:
            raise HTTPException(status_code=422, detail="Paket tidak boleh berisi dirinya sendiri.")
        comp = db.query(MenuItem).filter(MenuItem.id == comp_id).first()
        if not comp:
            raise HTTPException(status_code=422, detail="Ada isi paket yang menunya tidak dikenal.")
        if comp.is_bundle:
            raise HTTPException(status_code=422, detail=f"'{comp.name}' adalah paket: paket tidak boleh bersarang.")
        normalized.append({"id": comp_id, "quantity": qty})
    return json.dumps(normalized)


def _normalize_option(opt: dict, seen_names: set, context: str = "") -> dict:
    if not isinstance(opt, dict):
        raise HTTPException(status_code=422, detail=f"Opsi varian {context}tidak valid.")
    name = (opt.get("name") or "").strip()
    try:
        price = float(opt.get("price") or 0.0)
    except (ValueError, TypeError):
        raise HTTPException(status_code=422, detail=f"Biaya varian '{name}' tidak valid.")
    if not name:
        raise HTTPException(status_code=422, detail=f"Nama opsi varian {context}wajib diisi.")
    if name in seen_names:
        raise HTTPException(status_code=422, detail=f"Varian '{name}' {context}duplikat.")
    seen_names.add(name)
    return {"name": name, "price": price}


def _normalize_variants(variants) -> str | None:
    """Validasi & normalisasi varian menu (mendukung format flat & grup).

    - Format grup: [{"group": "Jenis Biji Kopi", "required": true, "multiple": false, "options": [{"name": "Arabica", "price": 0}]}]
    - Format flat (lama): [{"name": "Es", "price": 0}]
    Mengembalikan JSON string atau None (bila produk tidak memiliki varian).
    """
    if not variants or (isinstance(variants, str) and not variants.strip()):
        return None
    try:
        rows = json.loads(variants) if isinstance(variants, str) else variants
    except (ValueError, TypeError):
        raise HTTPException(status_code=422, detail="Varian menu tidak valid (bukan JSON).")
    if not isinstance(rows, list):
        raise HTTPException(status_code=422, detail="Varian menu tidak valid.")
    if not rows:
        return None

    is_grouped = any(isinstance(r, dict) and ("group" in r or "options" in r) for r in rows)
    if is_grouped:
        normalized_groups = []
        seen_groups = set()
        for row in rows:
            if not isinstance(row, dict):
                raise HTTPException(status_code=422, detail="Grup varian menu tidak valid.")
            group_name = (row.get("group") or "").strip()
            if not group_name:
                raise HTTPException(status_code=422, detail="Nama grup varian wajib diisi.")
            if group_name in seen_groups:
                raise HTTPException(status_code=422, detail=f"Grup varian '{group_name}' duplikat.")
            seen_groups.add(group_name)
            raw_options = row.get("options")
            if not isinstance(raw_options, list) or len(raw_options) == 0:
                raise HTTPException(status_code=422, detail=f"Grup varian '{group_name}' wajib memiliki minimal 1 pilihan.")
            seen_opts = set()
            options = [
                _normalize_option(opt, seen_opts, f"pada grup '{group_name}' ")
                for opt in raw_options
            ]
            normalized_groups.append({
                "group": group_name,
                "required": bool(row.get("required", False)),
                "multiple": bool(row.get("multiple", False)),
                "options": options,
            })
        return json.dumps(normalized_groups) if normalized_groups else None

    seen_flat = set()
    normalized = [_normalize_option(row, seen_flat) for row in rows]
    return json.dumps(normalized) if normalized else None


@router.get("", response_model=List[MenuItemResponse])
def get_all_menu(db: Session = Depends(get_db)):
    """Retrieve all menu items with aggregated total_sold count."""
    sales_data = (
        db.query(OrderItem.menu_item_id, func.coalesce(func.sum(OrderItem.quantity), 0))
        .filter(OrderItem.menu_item_id.isnot(None))
        .group_by(OrderItem.menu_item_id)
        .all()
    )
    sales_map = {item_id: int(qty) for item_id, qty in sales_data if item_id}

    items = db.query(MenuItem).order_by(MenuItem.created_at.asc()).all()
    for item in items:
        setattr(item, "total_sold", sales_map.get(item.id, 0))
    return items


@router.get("/{menu_id}", response_model=MenuItemResponse)
def get_menu_by_id(menu_id: str, db: Session = Depends(get_db)):
    """Retrieve single menu item by ID with total_sold count."""
    item = db.query(MenuItem).filter(MenuItem.id == menu_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Menu tidak ditemukan.")
    sold = (
        db.query(func.coalesce(func.sum(OrderItem.quantity), 0))
        .filter(OrderItem.menu_item_id == menu_id)
        .scalar()
    )
    setattr(item, "total_sold", int(sold or 0))
    return item


@router.post("/upload")
async def upload_menu_image(file: UploadFile = File(...), _admin: bool = Depends(require_admin)):
    """Upload file gambar menu ke backend dan hasilkan URL statis lokal (Admin)."""
    return {"url": await save_image(file, MENU_DIR, "menu", MAX_MENU_BYTES)}


@router.post("", response_model=MenuItemResponse, status_code=status.HTTP_201_CREATED)
def create_menu_item(payload: MenuItemCreate, db: Session = Depends(get_db), _admin: bool = Depends(require_admin)):
    """Add a new menu item (Admin)."""
    item_id = payload.id or f"menu-{uuid.uuid4().hex[:8]}"
    
    # Check if ID exists
    existing = db.query(MenuItem).filter(MenuItem.id == item_id).first()
    if existing:
        item_id = f"menu-{uuid.uuid4().hex[:8]}"

    new_item = MenuItem(
        id=item_id,
        name=payload.name,
        category=payload.category,
        description=payload.description,
        price=payload.price,
        image=payload.image or "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=700&auto=format&fit=crop&q=80",
        is_available=payload.is_available,
        is_bundle=bool(payload.is_bundle),
        bundle_items=_normalize_bundle(payload.is_bundle, payload.bundle_items, db, self_id=item_id),
        variants=_normalize_variants(payload.variants),
    )
    db.add(new_item)
    db.commit()
    db.refresh(new_item)
    return new_item


@router.put("/{menu_id}", response_model=MenuItemResponse)
def update_menu_item(menu_id: str, payload: MenuItemUpdate, db: Session = Depends(get_db), _admin: bool = Depends(require_admin)):
    """Update existing menu item (Admin)."""
    item = db.query(MenuItem).filter(MenuItem.id == menu_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Menu tidak ditemukan.")

    update_data = payload.model_dump(exclude_unset=True)
    if "is_bundle" in update_data or "bundle_items" in update_data:
        is_bundle = update_data.get("is_bundle", item.is_bundle)
        bundle_raw = update_data.get("bundle_items", item.bundle_items)
        normalized = _normalize_bundle(is_bundle, bundle_raw, db, self_id=menu_id)
        update_data["is_bundle"] = bool(is_bundle)
        update_data["bundle_items"] = normalized
    if "variants" in update_data:
        update_data["variants"] = _normalize_variants(update_data.get("variants"))
    for key, value in update_data.items():
        setattr(item, key, value)

    db.commit()
    db.refresh(item)
    return item


@router.patch("/{menu_id}/toggle", response_model=MenuItemResponse)
def toggle_menu_availability(menu_id: str, db: Session = Depends(get_db), _admin: bool = Depends(require_admin)):
    """Toggle menu availability between Tersedia and Habis (Admin)."""
    item = db.query(MenuItem).filter(MenuItem.id == menu_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Menu tidak ditemukan.")

    item.is_available = not item.is_available
    db.commit()
    db.refresh(item)
    return item


@router.delete("/{menu_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_menu_item(menu_id: str, db: Session = Depends(get_db), _admin: bool = Depends(require_admin)):
    """Delete a menu item (Admin)."""
    item = db.query(MenuItem).filter(MenuItem.id == menu_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Menu tidak ditemukan.")

    db.delete(item)
    db.commit()
    return None
