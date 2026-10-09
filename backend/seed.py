from sqlalchemy.orm import Session
from models import MenuItem


INITIAL_MENUS = [
    {
        "id": "menu-americano-apel",
        "name": "Kopi Americano Sirup Apel",
        "category": "Kopi Pilihan",
        "description": "Double shot espresso arabika dengan sirup apel fuji segar dan air alkali dingin berkarakter menyegarkan.",
        "price": 1.0,
        "image": "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=700&auto=format&fit=crop&q=80",
        "is_available": True
    },
    {
        "id": "menu-sdw-telur",
        "name": "Sandwich Telur",
        "category": "Artisan Sandwich",
        "description": "Telur orak-arik lembut gaya Jepang dengan mayones ringan, selada segar diapit roti artisan panggang mentega.",
        "price": 1.0,
        "image": "https://images.unsplash.com/photo-1525351484163-7529414344d8?w=700&auto=format&fit=crop&q=80",
        "is_available": True
    },
    {
        "id": "menu-sdw-ayam",
        "name": "Sandwich Ayam",
        "category": "Artisan Sandwich",
        "description": "Fillet dada ayam panggang rosemary herb, irisan tomat ceri organik, timun Kyuri renyah di atas roti ciabatta.",
        "price": 1.0,
        "image": "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=700&auto=format&fit=crop&q=80",
        "is_available": True
    },
    {
        "id": "menu-brownies-tusuk",
        "name": "Brownies Tusuk",
        "category": "Camilan Sehat",
        "description": "Brownies cokelat pekat Belgia lumer dengan taburan almond renyah, disajikan dalam tusukan kayu praktis dan higienis.",
        "price": 1.0,
        "image": "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=700&auto=format&fit=crop&q=80",
        "is_available": True
    }
]


def seed_database(db: Session):
    """Seed menu awal bila database masih kosong."""
    existing_count = db.query(MenuItem).count()
    if existing_count == 0:
        for item_data in INITIAL_MENUS:
            db.add(MenuItem(**item_data))
        db.commit()
        print("[SEED] Successfully populated 4 initial menu items.")
