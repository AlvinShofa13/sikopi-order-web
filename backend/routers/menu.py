import os
import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from auth_dep import require_admin
from database import get_db
from models import MenuItem
from routers.uploads import MAX_MENU_BYTES, MENU_DIR, save_image
from schemas import MenuItemCreate, MenuItemUpdate, MenuItemResponse

router = APIRouter(prefix="/menu", tags=["Menu Management"])


@router.get("", response_model=List[MenuItemResponse])
def get_all_menu(db: Session = Depends(get_db)):
    """Retrieve all menu items."""
    return db.query(MenuItem).order_by(MenuItem.created_at.asc()).all()


@router.get("/{menu_id}", response_model=MenuItemResponse)
def get_menu_by_id(menu_id: str, db: Session = Depends(get_db)):
    """Retrieve single menu item by ID."""
    item = db.query(MenuItem).filter(MenuItem.id == menu_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Menu tidak ditemukan.")
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
        is_available=payload.is_available
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
