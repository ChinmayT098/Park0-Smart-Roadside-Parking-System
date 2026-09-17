import cv2
import time
import os
import threading
import base64
from typing import Dict, List, Any, Optional
from datetime import datetime, date
import numpy as np
from backend.anpr import ANPRModule, is_valid_plate
from backend.timezone import get_ist_now, get_ist_date_str

# Try importing YOLO from ultralytics. Fall back to simulation if not available.
YOLO_AVAILABLE = False
try:
    from ultralytics import YOLO
    YOLO_AVAILABLE = True
except ImportError:
    pass

# Vehicle lengths in meters (from user specs)
VEHICLE_LENGTHS = {
    "Car": 4.5,
    "Bike": 2.0,
    "Bus": 10.0,
    "Truck": 8.0
}


class AICameraDetector:
    def __init__(self, shop_id: int, total_length: float, db_session_creator=None):
        self.shop_id = shop_id
        self.total_length = total_length
        self.db_session_creator = db_session_creator
        self.is_running = False
        self.model = None

        # Latest stats for WebSocket broadcast
        self.latest_stats = {
            "total_length": total_length,
            "occupied_length": 0.0,
            "remaining_length": total_length,
            "vehicle_count": 0,
            "vehicles": [],
            "status": "Available",
            "ai_status": "Starting..."
        }
        self.clients = set()
        self.lock = threading.Lock()
        self.last_db_update = 0

        # -----------------------------------------------------------------------
        # Two separate tracking structures:
        #
        # active_vehicles  — in-memory ByteTrack state for ALL detected vehicles,
        #                    regardless of plate status. Used for occupancy math.
        #                    NEVER written to the vehicles collection.
        #
        # confirmed_plates — vehicles that have a valid plate and a DB record.
        #                    Keyed by registration_number (strong identity signal).
        #                    Each entry also carries the DB park0_vehicle_id so the
        #                    live overlay can show it.
        # -----------------------------------------------------------------------
        self.active_vehicles: Dict[int, dict] = {}          # track_id -> info
        self.confirmed_plates: Dict[str, dict] = {}         # reg_number -> info

        self.anpr = ANPRModule(callback=self._on_plate_detected)

    # -----------------------------------------------------------------------
    # ANPR callback — called only when is_valid_plate() has already passed
    # -----------------------------------------------------------------------
    def _on_plate_detected(self, tracking_id: int, plate_text: str):
        """
        Called by the ANPR worker thread when a valid plate is found.
        This is the ONLY place where a Park0 vehicle DB record can be created.

        The plate has already passed is_valid_plate() in the ANPR module, but
        we double-check here for safety before doing any database work.
        """
        # Defensive double-check — reject any invalid value just in case
        if not is_valid_plate(plate_text):
            return

        with self.lock:
            if tracking_id not in self.active_vehicles:
                # Track was lost before OCR finished — discard
                return

            vehicle_type = self.active_vehicles[tracking_id]["vehicle_type"]
            existing_confirmed = self.confirmed_plates.get(plate_text)

            if existing_confirmed:
                # --- EXISTING VEHICLE — just reconnect the track ID, no new DB record ---
                old_tid = existing_confirmed.get("track_id")
                if old_tid != tracking_id:
                    print(
                        f"[Vehicle] Track ID changed: {old_tid} -> {tracking_id} "
                        f"for plate {plate_text} (Vehicle {existing_confirmed['park0_vehicle_id']})"
                    )
                    # Update in-memory mapping
                    self.confirmed_plates[plate_text]["track_id"] = tracking_id

                # Attach confirmed plate info to the active_vehicles entry so the
                # live overlay can show the Park0 Vehicle ID
                self.active_vehicles[tracking_id]["confirmed_registration"] = plate_text
                self.active_vehicles[tracking_id]["park0_vehicle_id"] = existing_confirmed["park0_vehicle_id"]

                # Update last_detected_at in DB asynchronously
                threading.Thread(
                    target=self._update_vehicle_last_seen_sync,
                    args=(existing_confirmed["db_id"],),
                    daemon=True
                ).start()

            else:
                # --- NEW VEHICLE — create DB record ---
                print(
                    f"[Vehicle] New valid plate detected: {plate_text} "
                    f"(Track {tracking_id}, {vehicle_type})"
                )
                # Run the DB write in a background thread to avoid blocking the
                # ANPR callback (which is already on a background thread, but we
                # hold self.lock here so keep it short)
                threading.Thread(
                    target=self._create_vehicle_record_sync,
                    args=(tracking_id, plate_text, vehicle_type),
                    daemon=True
                ).start()

    # -----------------------------------------------------------------------
    # DB helpers — sync (called from background threads)
    # -----------------------------------------------------------------------
    def _get_daily_counter_key(self) -> str:
        """Returns the daily counter key for Park0 Vehicle ID sequencing (midnight IST reset)."""
        today_str = get_ist_date_str()
        return f"vehicles_daily_{self.shop_id}_{today_str}"

    def _create_vehicle_record_sync(self, tracking_id: int, plate_text: str, vehicle_type: str):
        """
        Inserts a new confirmed vehicle into MongoDB and updates in-memory state.

        Rules enforced here (backend DB layer):
          1. plate_text MUST be valid (double-checked before insert).
          2. No duplicate for same shop + registration + date.
          3. Park0 Vehicle ID assigned ONLY at this point.
        """
        # Final backend validation guard — do not insert placeholder values
        if not is_valid_plate(plate_text):
            print(f"[Vehicle] REJECTED invalid plate before DB insert: '{plate_text}'")
            return

        try:
            from backend.database import get_sync_db, get_next_sequence_value_sync
            db = get_sync_db()
            today_str = get_ist_date_str()

            # ---------------------------------------------------------------
            # Duplicate check: same shop + registration + date
            # ---------------------------------------------------------------
            existing = db["vehicles"].find_one({
                "shop_id": self.shop_id,
                "registration_number": plate_text,
                "date": today_str
            })

            if existing:
                # Already in DB (e.g. process restarted) — reload into memory
                park0_id = existing["park0_vehicle_id"]
                db_id = existing["id"]
                print(
                    f"[Vehicle] Reloaded existing DB record for {plate_text} "
                    f"-> Vehicle {park0_id}"
                )
            else:
                # Assign the next daily sequential Park0 Vehicle ID
                daily_key = self._get_daily_counter_key()
                park0_id = get_next_sequence_value_sync(daily_key)
                db_id = get_next_sequence_value_sync("vehicles")

                now = get_ist_now()
                vehicle_doc = {
                    "id": db_id,
                    "park0_vehicle_id": park0_id,
                    "shop_id": self.shop_id,
                    "track_id": tracking_id,
                    "registration_number": plate_text,   # NEVER null/placeholder
                    "vehicle_type": vehicle_type,
                    "status": "active",
                    "first_detected_at": now,
                    "last_detected_at": now,
                    "date": today_str
                }
                db["vehicles"].insert_one(vehicle_doc)
                print(
                    f"[Vehicle] Created DB record: Vehicle {park0_id} | "
                    f"{plate_text} | {vehicle_type} | Shop {self.shop_id}"
                )

            # ---------------------------------------------------------------
            # Update in-memory confirmed state (under lock)
            # ---------------------------------------------------------------
            with self.lock:
                self.confirmed_plates[plate_text] = {
                    "db_id": db_id,
                    "park0_vehicle_id": park0_id,
                    "track_id": tracking_id,
                    "vehicle_type": vehicle_type
                }
                # Attach park0 info to the live active_vehicles entry
                if tracking_id in self.active_vehicles:
                    self.active_vehicles[tracking_id]["confirmed_registration"] = plate_text
                    self.active_vehicles[tracking_id]["park0_vehicle_id"] = park0_id

        except Exception as e:
            print(f"[Vehicle] Error creating vehicle record for {plate_text}: {e}")

    def _update_vehicle_last_seen_sync(self, db_id: int):
        """Updates last_detected_at timestamp for an already-confirmed vehicle."""
        try:
            from backend.database import get_sync_db
            db = get_sync_db()
            db["vehicles"].update_one(
                {"id": db_id},
                {"$set": {"last_detected_at": get_ist_now()}}
            )
        except Exception as e:
            print(f"[Vehicle] Error updating last_seen for db_id {db_id}: {e}")

    def _mark_vehicle_exited_sync(self, db_id: int):
        """Marks a confirmed vehicle as exited in MongoDB."""
        try:
            from backend.database import get_sync_db
            db = get_sync_db()
            db["vehicles"].update_one(
                {"id": db_id},
                {"$set": {"status": "exited", "last_detected_at": get_ist_now()}}
            )
        except Exception as e:
            print(f"[Vehicle] Error marking vehicle {db_id} as exited: {e}")

    # -----------------------------------------------------------------------
    # Camera model loading
    # -----------------------------------------------------------------------
    def load_model(self):
        """Loads the YOLOv8 model if available."""
        if YOLO_AVAILABLE:
            try:
                self.latest_stats["ai_status"] = "Loading YOLOv8..."
                self.model = YOLO("yolov8n.pt")
                self.latest_stats["ai_status"] = "YOLOv8 Active"
            except Exception as e:
                print(f"Failed to load YOLO model: {e}")
                self.model = None
                self.latest_stats["ai_status"] = f"YOLO Load Error: {str(e)}"
        else:
            self.latest_stats["ai_status"] = "YOLO Load Error: Ultralytics not installed"

    def start(self):
        """Starts the camera detector and loads the model asynchronously."""
        with self.lock:
            if self.is_running:
                return
            self.is_running = True
            threading.Thread(target=self.load_model, daemon=True).start()
            self.anpr.start()

    def stop(self):
        """Stops the camera detector and marks active confirmed vehicles as EXITED."""
        with self.lock:
            self.is_running = False
            self.anpr.stop()
            # Section 14: CAMERA OFF requirement:
            # Mark all currently active confirmed vehicles as EXITED in DB
            for reg, info in list(self.confirmed_plates.items()):
                db_id = info.get("db_id")
                if db_id:
                    threading.Thread(
                        target=self._mark_vehicle_exited_sync,
                        args=(db_id,),
                        daemon=True
                    ).start()
            self.confirmed_plates.clear()
            self.active_vehicles.clear()

    def add_client(self, websocket):
        """Adds a client WebSocket to receive updates."""
        self.clients.add(websocket)

    def remove_client(self, websocket):
        """Removes a client WebSocket."""
        if websocket in self.clients:
            self.clients.remove(websocket)

    # -----------------------------------------------------------------------
    # Frame processing
    # -----------------------------------------------------------------------
    def process_frame(self, frame_data_b64: str) -> Dict[str, Any]:
        """Processes a single base64-encoded frame sent from the frontend."""
        if not self.is_running:
            return self.latest_stats

        try:
            # Decode base64 image
            if "," in frame_data_b64:
                header, encoded = frame_data_b64.split(",", 1)
            else:
                encoded = frame_data_b64

            data = base64.b64decode(encoded)
            nparr = np.frombuffer(data, np.uint8)
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

            if frame is None:
                raise ValueError("Decoded frame is None")

            detected = self._detect_vehicles(frame)
            current_time = time.time()

            with self.lock:
                # ------------------------------------------------------------------
                # Update active_vehicles (in-memory tracking state)
                # This is used for OCCUPANCY MATH only — NOT for DB record creation.
                # ------------------------------------------------------------------
                for v in detected:
                    tid = v["tracking_id"]

                    if tid not in self.active_vehicles:
                        self.active_vehicles[tid] = {
                            "tracking_id": tid,
                            "vehicle_type": v["type"],
                            "confidence": v["confidence"],
                            "bbox": [v["x"], v["y"], v["x"] + v["w"], v["y"] + v["h"]],
                            "first_seen": current_time,
                            "last_seen": current_time,
                            "status": "active",
                            # These two are set ONLY after valid plate confirmation:
                            "confirmed_registration": None,
                            "park0_vehicle_id": None,
                            "length": v["length"]
                        }
                        print(f"[Tracking] VEHICLE_ENTERED: Track {tid} ({v['type']}) — waiting for plate")
                    else:
                        self.active_vehicles[tid]["last_seen"] = current_time
                        self.active_vehicles[tid]["bbox"] = [v["x"], v["y"], v["x"] + v["w"], v["y"] + v["h"]]
                        self.active_vehicles[tid]["confidence"] = v["confidence"]

                    # Queue for ANPR only if plate not yet confirmed for this track
                    confirmed_reg = self.active_vehicles[tid].get("confirmed_registration")
                    if confirmed_reg is None and v.get("crop") is not None:
                        self.anpr.enqueue_crop(tid, v["crop"])

                # ------------------------------------------------------------------
                # Handle exits (not seen for > 2 seconds)
                # ------------------------------------------------------------------
                exited_ids = []
                for tid, info in self.active_vehicles.items():
                    if current_time - info["last_seen"] > 2.0:
                        exited_ids.append(tid)

                for tid in exited_ids:
                    info = self.active_vehicles[tid]
                    confirmed_reg = info.get("confirmed_registration")

                    if confirmed_reg and confirmed_reg in self.confirmed_plates:
                        # Confirmed vehicle exited — update DB record status
                        db_id = self.confirmed_plates[confirmed_reg]["db_id"]
                        park0_id = self.confirmed_plates[confirmed_reg]["park0_vehicle_id"]
                        print(
                            f"[Tracking] VEHICLE_EXITED: Track {tid} "
                            f"| Vehicle {park0_id} | {confirmed_reg}"
                        )
                        threading.Thread(
                            target=self._mark_vehicle_exited_sync,
                            args=(db_id,),
                            daemon=True
                        ).start()
                        # Remove from confirmed_plates so a future re-entry can
                        # update status back to active (handled in _create_vehicle_record_sync
                        # via the existing-record reload path)
                        del self.confirmed_plates[confirmed_reg]
                    else:
                        # Unidentified vehicle left — no DB record was created, nothing to do
                        print(
                            f"[Tracking] UNIDENTIFIED_VEHICLE_EXITED: Track {tid} "
                            f"({info['vehicle_type']}) — no DB record created"
                        )

                    del self.active_vehicles[tid]

                # ------------------------------------------------------------------
                # Compute occupancy statistics from ALL active vehicles (including
                # unidentified ones, which is correct for physical space estimation)
                # ------------------------------------------------------------------
                occupied_length = sum(
                    info["length"] for info in self.active_vehicles.values()
                )
                occupied_length = min(occupied_length, self.total_length)
                remaining_length = max(0.0, self.total_length - occupied_length)

                occupancy_pct = (occupied_length / self.total_length) * 100 if self.total_length > 0 else 100
                if occupancy_pct >= 95:
                    status = "Full"
                elif occupancy_pct >= 75:
                    status = "Nearly Full"
                else:
                    status = "Available"

                self.latest_stats = {
                    "total_length": self.total_length,
                    "occupied_length": round(occupied_length, 2),
                    "remaining_length": round(remaining_length, 2),
                    "vehicle_count": len(self.active_vehicles),
                    "vehicles": [
                        {
                            "tracking_id": info["tracking_id"],
                            "type": info["vehicle_type"],
                            "length": info["length"],
                            "confidence": int(info["confidence"] * 100),
                            # Only expose plate/park0_id if confirmed — null otherwise
                            "plate_number": info.get("confirmed_registration"),
                            "park0_vehicle_id": info.get("park0_vehicle_id"),
                            "x": info["bbox"][0],
                            "y": info["bbox"][1],
                            "w": info["bbox"][2] - info["bbox"][0],
                            "h": info["bbox"][3] - info["bbox"][1]
                        }
                        for info in self.active_vehicles.values()
                    ],
                    "status": status,
                    "ai_status": self.latest_stats.get("ai_status", "YOLOv8 Active")
                }

            # Write camera log to database occasionally (every 10 seconds)
            current_time = time.time()
            if current_time - self.last_db_update > 10:
                active_list = [
                    {
                        "type": v["vehicle_type"],
                        "length": v["length"],
                        "confidence": float(v["confidence"]),
                        "plate": v.get("confirmed_registration")
                    }
                    for v in self.active_vehicles.values()
                ]
                self._save_log_to_db(active_list, occupied_length, remaining_length)
                self.last_db_update = current_time

        except Exception as e:
            print(f"Error processing camera frame for shop {self.shop_id}: {e}")

        return self.latest_stats

    # -----------------------------------------------------------------------
    # Simulation helpers
    # -----------------------------------------------------------------------
    def _generate_simulated_frame(self):
        """Generates a dummy frame for simulation/testing."""
        return np.zeros((480, 640, 3), dtype=np.uint8)

    def _get_simulated_detections(self) -> List[Dict[str, Any]]:
        """Generates dynamic simulated detections that change slightly over time."""
        t = time.time()
        dx1 = int(15 * np.sin(t * 1.5))
        dy1 = int(8 * np.cos(t * 1.0))
        dx2 = int(12 * np.cos(t * 0.8))
        dy2 = int(10 * np.sin(t * 1.2))

        return [
            {
                "tracking_id": 1,
                "type": "Car",
                "length": VEHICLE_LENGTHS["Car"],
                "confidence": round(0.85 + 0.05 * np.sin(t * 2), 2),
                "x": 120 + dx1,
                "y": 180 + dy1,
                "w": 180,
                "h": 120,
                "crop": np.zeros((120, 180, 3), dtype=np.uint8)
            },
            {
                "tracking_id": 2,
                "type": "Bike",
                "length": VEHICLE_LENGTHS["Bike"],
                "confidence": round(0.90 + 0.04 * np.cos(t * 3), 2),
                "x": 380 + dx2,
                "y": 220 + dy2,
                "w": 80,
                "h": 100,
                "crop": np.zeros((100, 80, 3), dtype=np.uint8)
            }
        ]

    # -----------------------------------------------------------------------
    # YOLO / ByteTrack detection
    # -----------------------------------------------------------------------
    def _detect_vehicles(self, frame) -> List[Dict[str, Any]]:
        """Runs YOLOv8 + ByteTrack on a frame and returns structured predictions."""
        if self.model is None:
            if not getattr(self, "logged_simulation_active", False):
                print(
                    f"[AI Detector] YOLOv8 model not loaded for shop {self.shop_id}. "
                    f"Falling back to simulation."
                )
                self.logged_simulation_active = True
            return self._get_simulated_detections()

        detected = []
        try:
            results = self.model.track(frame, persist=True, tracker="bytetrack.yaml", verbose=False)
            if not results or len(results) == 0:
                return []

            result = results[0]
            box_list = result.boxes

            if box_list is None or len(box_list) == 0:
                return []

            for box in box_list:
                cls_id = int(box.cls[0].item())
                conf = float(box.conf[0].item())

                track_id = None
                if box.id is not None:
                    track_id = int(box.id[0].item())

                if conf < 0.35:
                    continue

                xyxy = box.xyxy[0].tolist()
                x1, y1, x2, y2 = map(int, xyxy)

                vehicle_type = None
                if cls_id == 2:    # Car
                    vehicle_type = "Car"
                elif cls_id == 3:  # Motorcycle -> Bike
                    vehicle_type = "Bike"
                elif cls_id == 5:  # Bus
                    vehicle_type = "Bus"
                elif cls_id == 7:  # Truck
                    vehicle_type = "Truck"

                if vehicle_type and track_id is not None:
                    crop = None
                    if y2 > y1 and x2 > x1:
                        crop = frame[y1:y2, x1:x2]

                    detected.append({
                        "tracking_id": track_id,
                        "type": vehicle_type,
                        "length": VEHICLE_LENGTHS[vehicle_type],
                        "confidence": conf,
                        "x": x1,
                        "y": y1,
                        "w": x2 - x1,
                        "h": y2 - y1,
                        "crop": crop
                    })

        except Exception as e:
            print(f"YOLO tracking exception: {e}")

        return detected

    # -----------------------------------------------------------------------
    # Camera log DB write (unchanged)
    # -----------------------------------------------------------------------
    def _save_log_to_db(self, detected: List[Dict[str, Any]], occupied: float, remaining: float):
        """Saves current camera measurements to database and updates Shop status."""
        try:
            from backend.database import get_sync_db, get_next_sequence_value_sync
            sync_db = get_sync_db()
            log_id = get_next_sequence_value_sync("camera_logs")
            log_doc = {
                "id": log_id,
                "shop_id": self.shop_id,
                "detected_vehicles": detected,
                "occupied_length": occupied,
                "remaining_length": remaining,
                "timestamp": datetime.utcnow()
            }
            sync_db["camera_logs"].insert_one(log_doc)
        except Exception as e:
            print(f"Error logging camera stats to database: {e}")
