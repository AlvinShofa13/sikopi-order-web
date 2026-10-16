"""CRUD kategori menu (Admin; daftar publik untuk tab menu)."""

from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from auth_dep import require_admin
from database import get_db
from models import Category, MenuItem
from schemas import CategoryCreate, CategoryResponse, CategoryUpdate

router = APIRouter(prefix="/categories", tags=["Menu Categories"])


def _clean_name(raw) -> str:
    name = (raw or "").strip()
    if not name:
        raise HTTPException(status_code=422, detail="Nama kategori wajib diisi.")
    if len(name) > 100:
        raise HTTPException(status_code=422, detail="Nama kategori maksimal 100 karakter.")
    return name


@router.get("", response_model=List[CategoryResponse])
def get_all_categories(db: Session = Depends(get_db)):
    """Daftar kategori (Publik — dipakai tab menu & select form)."""
    return db.query(Category).order_by(Category.id.asc()).all()


@router.post("", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
def create_category(payload: CategoryCreate, db: Session = Depends(get_db), _admin: bool = Depends(require_admin)):
    """Tambah kategori (Admin)."""
    name = _clean_name(payload.name)
    if db.query(Category).filter(Category.name.ilike(name)).first():
        raise HTTPException(status_code=409, detail=f"Kategori '{name}' sudah ada.")
    cat = Category(name=name)
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat


@router.put("/{category_id}", response_model=CategoryResponse)
def update_category(category_id: int, payload: CategoryUpdate, db: Session = Depends(get_db), _admin: bool = Depends(require_admin)):
    """Ubah nama kategori (Admin). Menu berkategori lama ikut diperbarui."""
    cat = db.query(Category).filter(Category.id == category_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Kategori tidak ditemukan.")
    name = _clean_name(payload.name)
    dup = db.query(Category).filter(Category.name.ilike(name)).first()
    if dup and dup.id != cat.id:
        raise HTTPException(status_code=409, detail=f"Kategori '{name}' sudah ada.")
    old_name = cat.name
    cat.name = name
    if old_name != name:
        db.query(MenuItem).filter(MenuItem.category == old_name).update({"category": name})
    db.commit()
    db.refresh(cat)
    return cat


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(category_id: int, db: Session = Depends(get_db), _admin: bool = Depends(require_admin)):
    """Hapus kategori (Admin). Ditolak bila masih dipakai menu."""
    cat = db.query(Category).filter(Category.id == category_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Kategori tidak ditemukan.")
    used = db.query(MenuItem).filter(MenuItem.category == cat.name).count()
    if used:
        raise HTTPException(
            status_code=409,
            detail=f"Kategori '{cat.name}' masih dipakai {used} menu. Pindahkan dulu menunya.",
        )
    db.delete(cat)
    db.commit()
    return None
