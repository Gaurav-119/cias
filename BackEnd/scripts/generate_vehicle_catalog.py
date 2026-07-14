"""Generate vehicle_master_catalog.csv with Indian passenger vehicle data."""
from __future__ import annotations

import csv
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "vehicle_master_catalog.csv"

rows: list[list] = []

hyundai_models = {
    "Grand i10 Nios": [
        ("E", "Petrol", "Manual", 599000),
        ("Sportz", "Petrol", "Manual", 749000),
        ("Asta", "Petrol", "AMT", 849000),
    ],
    "i20": [
        ("Magna", "Petrol", "Manual", 699000),
        ("Sportz", "Petrol", "Manual", 849000),
        ("Asta", "Petrol", "AMT", 999000),
    ],
    "Aura": [("E", "Petrol", "Manual", 649000), ("S", "Petrol", "AMT", 899000)],
    "Venue": [
        ("E", "Petrol", "Manual", 899000),
        ("S", "Petrol", "Manual", 1049000),
        ("SX", "Petrol", "AMT", 1249000),
    ],
    "Verna": [
        ("EX", "Petrol", "Manual", 1099000),
        ("SX", "Petrol", "Automatic", 1499000),
    ],
    "Creta": [
        ("E", "Petrol", "Manual", 1099000),
        ("EX", "Petrol", "Manual", 1249000),
        ("S", "Diesel", "Manual", 1349000),
        ("SX", "Petrol", "Automatic", 1749000),
        ("SX(O)", "Petrol", "Automatic", 1999000),
    ],
    "Alcazar": [
        ("Prestige", "Petrol", "Automatic", 1699000),
        ("Signature", "Diesel", "Automatic", 2099000),
    ],
    "Tucson": [("Signature", "Petrol", "Automatic", 2799000)],
    "Exter": [("EX", "Petrol", "Manual", 849000), ("SX", "Petrol", "AMT", 999000)],
}
for model, variants in hyundai_models.items():
    body = "SUV" if model in {"Creta", "Alcazar", "Tucson", "Venue", "Exter"} else "Hatchback"
    for variant, fuel, trans, price in variants:
        cc = 1493 if fuel == "Diesel" else 1197
        rows.append(
            ["Hyundai", model, variant, fuel, trans, body, "Mid", 2020, "", cc, price]
        )

maruti = {
    "Alto K10": [("Std", "Petrol", "Manual", 399000), ("LXi", "Petrol", "Manual", 449000)],
    "S-Presso": [("Std", "Petrol", "Manual", 449000), ("VXi", "Petrol", "AMT", 599000)],
    "WagonR": [("LXi", "Petrol", "Manual", 599000), ("VXi", "Petrol", "AMT", 749000)],
    "Celerio": [("LXi", "Petrol", "Manual", 549000), ("VXi", "Petrol", "AMT", 699000)],
    "Swift": [
        ("LXi", "Petrol", "Manual", 649000),
        ("VXi", "Petrol", "Manual", 749000),
        ("ZXi", "Petrol", "AMT", 949000),
    ],
    "Dzire": [("LXi", "Petrol", "Manual", 699000), ("VXi", "Petrol", "AMT", 899000)],
    "Baleno": [
        ("Sigma", "Petrol", "Manual", 699000),
        ("Delta", "Petrol", "Manual", 799000),
        ("Alpha", "Petrol", "AMT", 999000),
    ],
    "Fronx": [("Sigma", "Petrol", "Manual", 799000), ("Delta", "Petrol", "AMT", 999000)],
    "Brezza": [
        ("LXi", "Petrol", "Manual", 899000),
        ("VXi", "Petrol", "Manual", 1049000),
        ("ZXi", "Petrol", "Automatic", 1399000),
    ],
    "Ertiga": [("LXi", "Petrol", "Manual", 949000), ("VXi", "Petrol", "Manual", 1099000)],
    "XL6": [("Zeta", "Petrol", "Manual", 1199000), ("Alpha", "Petrol", "Automatic", 1499000)],
    "Grand Vitara": [("Sigma", "Petrol", "Manual", 1099000), ("Alpha", "Hybrid", "Automatic", 1999000)],
    "Invicto": [("Zeta", "Hybrid", "Automatic", 2499000)],
    "Jimny": [("Zeta", "Petrol", "Manual", 1299000), ("Alpha", "Petrol", "Automatic", 1599000)],
}
for model, variants in maruti.items():
    body = "SUV" if model in {"Brezza", "Fronx"} else "MPV" if model == "Ertiga" else "Hatchback"
    for variant, fuel, trans, price in variants:
        rows.append(
            ["Maruti Suzuki", model, variant, fuel, trans, body, "Compact", 2018, "", 1197, price]
        )

tata = {
    "Nexon": [
        ("Smart", "Petrol", "Manual", 799000),
        ("Smart+", "Petrol", "Manual", 949000),
        ("Fearless", "Electric", "Automatic", 1499000),
    ],
    "Punch": [("Pure", "Petrol", "Manual", 649000), ("Adventure", "Petrol", "AMT", 899000)],
    "Harrier": [
        ("Smart", "Diesel", "Manual", 1549000),
        ("Fearless", "Diesel", "Automatic", 2299000),
    ],
    "Safari": [
        ("Smart", "Diesel", "Manual", 1649000),
        ("Accomplished", "Diesel", "Automatic", 2499000),
    ],
}
for model, variants in tata.items():
    for variant, fuel, trans, price in variants:
        rows.append(["Tata", model, variant, fuel, trans, "SUV", "Mid", 2019, "", 0, price])

extras = [
    ("Toyota", "Innova Crysta", "GX", "Diesel", "Manual", "MPV", "Premium", 2016, "", 2393, 1999000),
    ("Toyota", "Fortuner", "4x2 AT", "Diesel", "Automatic", "SUV", "Premium", 2016, "", 2755, 3499000),
    ("Honda", "City", "V", "Petrol", "Manual", "Sedan", "Mid", 2020, "", 1498, 1249000),
    ("Honda", "Amaze", "VX", "Petrol", "CVT", "Sedan", "Compact", 2018, "", 1199, 999000),
    ("Kia", "Seltos", "HTK", "Petrol", "Manual", "SUV", "Mid", 2019, "", 1497, 1099000),
    ("Kia", "Seltos", "HTX", "Diesel", "Automatic", "SUV", "Mid", 2019, "", 1493, 1799000),
    ("Kia", "Sonet", "HTK", "Petrol", "Manual", "SUV", "Compact", 2020, "", 1197, 799000),
    ("MG", "Hector", "Style", "Petrol", "Manual", "SUV", "Mid", 2019, "", 1451, 1299000),
    ("MG", "Astor", "Sharp", "Petrol", "CVT", "SUV", "Mid", 2021, "", 1349, 1699000),
    ("Volkswagen", "Virtus", "Comfortline", "Petrol", "Manual", "Sedan", "Mid", 2022, "", 999, 1199000),
    ("Skoda", "Slavia", "Ambition", "Petrol", "Manual", "Sedan", "Mid", 2022, "", 999, 1249000),
    ("Renault", "Kiger", "RXE", "Petrol", "Manual", "SUV", "Compact", 2021, "", 999, 649000),
    ("Nissan", "Magnite", "XE", "Petrol", "Manual", "SUV", "Compact", 2020, "", 999, 649000),
    ("Jeep", "Compass", "Sport", "Diesel", "Manual", "SUV", "Mid", 2017, "", 1956, 2499000),
    ("Citroen", "C3", "Live", "Petrol", "Manual", "Hatchback", "Compact", 2022, "", 1199, 649000),
    ("Mahindra", "XUV700", "MX", "Petrol", "Manual", "SUV", "Mid", 2021, "", 1997, 1399000),
    ("Mahindra", "Scorpio-N", "Z4", "Diesel", "Manual", "SUV", "Mid", 2022, "", 2184, 1499000),
    ("BMW", "3 Series", "320d", "Diesel", "Automatic", "Sedan", "Luxury", 2019, "", 1995, 5290000),
    ("Mercedes-Benz", "C-Class", "C200", "Petrol", "Automatic", "Sedan", "Luxury", 2021, "", 1496, 6100000),
    ("Audi", "A4", "Premium", "Petrol", "Automatic", "Sedan", "Luxury", 2020, "", 1984, 4699000),
]
for e in extras:
    rows.append(list(e))

OUT.parent.mkdir(parents=True, exist_ok=True)
with OUT.open("w", newline="", encoding="utf-8") as f:
    writer = csv.writer(f)
    writer.writerow(
        [
            "brand",
            "model",
            "variant",
            "fuel_type",
            "transmission",
            "body_type",
            "segment",
            "manufacturing_start_year",
            "manufacturing_end_year",
            "engine_cc",
            "ex_showroom_price",
            "currency",
            "is_active",
        ]
    )
    for r in rows:
        writer.writerow(r + ["INR", "true"])

print(f"Wrote {len(rows)} rows to {OUT}")
