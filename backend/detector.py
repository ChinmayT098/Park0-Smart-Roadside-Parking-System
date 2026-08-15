import cv2
import time
import os
import threading
import base64
from typing import Dict, List, Any
from datetime import datetime
import numpy as np
from backend.anpr import ANPRModule

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
        
        # Latest stats
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
        
        # Tracking and ANPR
        self.active_vehicles = {}
        self.anpr = ANPRModule(callback=self._on_plate_detected)

    def _on_plate_detected(self, tracking_id: int, plate_text: str):
        with self.lock:
            if tracking_id in self.active_vehicles:
                self.active_vehicles[tracking_id]["plate_number"] = plate_text
                print(f"[Event] VEHICLE_PLATE_DETECTED: ID {tracking_id} -> {plate_text}")

    def load_model(self):
        """Loads the YOLOv8 model if available."""
        if YOLO_AVAILABLE:
            try:
                self.latest_stats["ai_status"] = "Loading YOLOv8..."
                # YOLOv8 nano model (lightweight, runs fast on CPU)
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
        """Stops the camera detector."""
        with self.lock:
            self.is_running = False
            self.anpr.stop()

    def add_client(self, websocket):
        """Adds a client WebSocket to receive updates."""
        self.clients.add(websocket)

    def remove_client(self, websocket):
        """Removes a client WebSocket."""
        if websocket in self.clients:
            self.clients.remove(websocket)

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
                
            # Perform vehicle detection (now includes tracking IDs)
            detected = self._detect_vehicles(frame)
            current_time = time.time()
            
            with self.lock:
                # Update active vehicles
                for v in detected:
                    tid = v["tracking_id"]
                    
                    if tid not in self.active_vehicles:
                        self.active_vehicles[tid] = {
                            "tracking_id": tid,
                            "vehicle_type": v["type"],
                            "confidence": v["confidence"],
                            "bbox": [v["x"], v["y"], v["x"]+v["w"], v["y"]+v["h"]],
                            "first_seen": current_time,
                            "last_seen": current_time,
                            "status": "active",
                            "plate_number": None,
                            "length": v["length"]
                        }
                        print(f"[Event] VEHICLE_ENTERED: ID {tid} ({v['type']})")
                    else:
                        self.active_vehicles[tid]["last_seen"] = current_time
                        self.active_vehicles[tid]["bbox"] = [v["x"], v["y"], v["x"]+v["w"], v["y"]+v["h"]]
                        self.active_vehicles[tid]["confidence"] = v["confidence"]
                        
                    # Queue for ANPR if plate is not detected
                    if self.active_vehicles[tid]["plate_number"] is None and v.get("crop") is not None:
                        self.anpr.enqueue_crop(tid, v["crop"])
                        
                # Handle exits (not seen for > 2.0 seconds)
                exited_ids = []
                for tid, info in self.active_vehicles.items():
                    if current_time - info["last_seen"] > 2.0:
                        exited_ids.append(tid)
                        
                for tid in exited_ids:
                    print(f"[Event] VEHICLE_EXITED: ID {tid}")
                    # Optionally publish exit event here before deleting
                    del self.active_vehicles[tid]
            
                # Compute occupancy statistics based on active vehicles
                occupied_length = sum([info["length"] for info in self.active_vehicles.values()])
                occupied_length = min(occupied_length, self.total_length)
                remaining_length = max(0.0, self.total_length - occupied_length)
                
                # Determine parking status
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
                            "plate_number": info["plate_number"],
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
            
            # Write log to database occasionally (every 10 seconds)
            current_time = time.time()
            if current_time - self.last_db_update > 10:
                # Log the active vehicles instead of single frame detections
                active_list = [{"type": v["vehicle_type"], "length": v["length"], "confidence": float(v["confidence"]), "plate": v["plate_number"]} for v in self.active_vehicles.values()]
                self._save_log_to_db(active_list, occupied_length, remaining_length)
                self.last_db_update = current_time
                
        except Exception as e:
            print(f"Error processing camera frame for shop {self.shop_id}: {e}")
            
        return self.latest_stats

    def _generate_simulated_frame(self):
        """Generates a dummy frame for simulation/testing (e.g. blank black image)."""
        return np.zeros((480, 640, 3), dtype=np.uint8)

    def _get_simulated_detections(self) -> List[Dict[str, Any]]:
        """Generates dynamic simulated detections that change slightly over time."""
        t = time.time()
        # Let's say there are 2 vehicles, their coordinates oscillate slightly
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
                "crop": np.zeros((120, 180, 3), dtype=np.uint8) # mock crop
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

    def _detect_vehicles(self, frame) -> List[Dict[str, Any]]:
        """Runs YOLOv8 object detection on a frame and returns structured predictions."""
        if self.model is None:
            if not getattr(self, "logged_simulation_active", False):
                print(f"[AI Detector] YOLOv8 model not loaded for shop {self.shop_id}. Falling back to simulation.")
                self.logged_simulation_active = True
            return self._get_simulated_detections()

        detected = []
        try:
            # Use ByteTrack for object tracking
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
                
                # Retrieve tracking ID
                track_id = None
                if box.id is not None:
                    track_id = int(box.id[0].item())
                
                if conf < 0.35:  # Confidence threshold
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
                    # Create image crop for ANPR
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

    def _save_log_to_db(self, detected: List[Dict[str, Any]], occupied: float, remaining: float):
        """Saves current camera measurements to database and updates the active Shop status."""
        try:
            from backend.database import get_sync_db, get_next_sequence_value_sync
            sync_db = get_sync_db()
            # detected is already passed as the active_vehicles formatted list
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
